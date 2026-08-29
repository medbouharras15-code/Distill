-- Schéma Distill : comptes utilisateurs + abonnement Lemon Squeezy
-- À exécuter une fois dans Supabase : Dashboard > SQL Editor > New query > coller > Run

-- 1. Table de profil, une ligne par utilisateur (liée à auth.users géré par Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  generations_used integer not null default 0,
  lemonsqueezy_subscription_id text unique,
  -- 'free' tant que l'utilisateur n'a jamais souscrit, sinon le statut Lemon
  -- Squeezy brut ('on_trial', 'active', 'paused', 'past_due', 'unpaid',
  -- 'cancelled', 'expired').
  subscription_status text not null default 'free',
  created_at timestamptz not null default now()
);

-- Migration : si la table existait déjà avec l'ancienne colonne PayPal, on la renomme.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'paypal_subscription_id'
  ) then
    alter table public.profiles rename column paypal_subscription_id to lemonsqueezy_subscription_id;
  end if;
end $$;

-- Migration : palier réel de l'abonnement (offre à 3 paliers, voir
-- @/components/SubscriptionForm) — 'essentiel'/'etudiant'/'intensif'.
-- Nullable : reste vide pour l'essai gratuit, et pour les abonnés déjà
-- actifs avant cette migration (voir getTier dans @/lib/billing, qui les
-- traite comme "intensif" par défaut plutôt que de les rétrograder).
alter table public.profiles add column if not exists subscription_tier text
  check (subscription_tier in ('essentiel', 'etudiant', 'intensif'));

-- Migration : identifiants Paddle, en plus des colonnes Lemon Squeezy
-- ci-dessus plutôt qu'à leur place — les deux prestataires cohabitent
-- temporairement, Paddle pour tout nouvel abonné, Lemon Squeezy conservé
-- tel quel pour l'unique abonné existant avant cette migration (voir
-- /api/paddle/*). subscription_status reçoit directement la chaîne brute
-- renvoyée par le prestataire qui a écrit la ligne (Lemon Squeezy ou
-- Paddle) — les deux utilisent déjà "active" pour l'état payant, seule
-- valeur qui compte pour isSubscribed() dans @/lib/billing.
alter table public.profiles add column if not exists paddle_subscription_id text unique;
alter table public.profiles add column if not exists paddle_customer_id text;

-- Migration : identifiants Paddle sur `teams` (facturation Business Team,
-- par siège) — même principe que ci-dessus pour `profiles`, en plus de
-- lemonsqueezy_subscription_id (jamais réellement utilisée : aucune équipe
-- n'a de facturation Lemon Squeezy active, voir le commentaire sur `teams`
-- plus haut). seat_count, déjà présente, reçoit le nombre de sièges
-- réellement facturé (items[].quantity du webhook), pas seulement la valeur
-- par défaut à la création de l'équipe.
alter table public.teams add column if not exists paddle_subscription_id text unique;
alter table public.teams add column if not exists paddle_customer_id text;

-- 2. Sécurité au niveau des lignes : chaque utilisateur ne voit / ne modifie
-- que sa propre ligne. Les écritures sensibles (compteur d'usage, statut
-- d'abonnement) sont faites uniquement par le serveur avec la clé "service
-- role", qui contourne cette protection — les utilisateurs ne peuvent donc
-- pas se donner eux-mêmes un abonnement ou remettre leur compteur à zéro.
alter table public.profiles enable row level security;

create policy "Un utilisateur voit son propre profil"
  on public.profiles for select
  using (auth.uid() = id);

-- 3. Création automatique du profil à chaque inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Suivi de la consommation IA réelle (en euros), une ligne par appel
-- Claude réel réussi sur /api/distill, /api/distill/quiz ou
-- /api/distill/chat (le mode simulation Preview n'écrit jamais ici, voir
-- @/lib/aiSimulation). Sert à afficher la consommation du mois en cours
-- dans Paramètres > IA Distill, comparée au plafond du palier (voir
-- @/lib/aiUsage).
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 'generation' = résumé/flashcards/QCM (/api/distill, /api/distill/quiz),
  -- 'chat' = Mode Explication (/api/distill/chat).
  category text not null check (category in ('generation', 'chat')),
  -- Modèle qui a réellement répondu (response.model) — peut différer du
  -- modèle par défaut en cas de repli automatique Haiku → Sonnet.
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  -- Coût calculé et figé au moment de l'écriture (voir @/lib/aiUsage) : les
  -- tokens bruts ci-dessus permettent de recalculer plus tard si les
  -- tarifs changent, ce coût figé évite de refaire le calcul à chaque
  -- lecture de la page.
  cost_eur numeric(10, 4) not null default 0
);

create index if not exists ai_usage_events_user_id_created_at_idx
  on public.ai_usage_events (user_id, created_at);

alter table public.ai_usage_events enable row level security;

create policy "Un utilisateur voit ses propres événements de consommation IA"
  on public.ai_usage_events for select
  using (auth.uid() = user_id);

-- Aucune policy insert/update/delete : seul le serveur, via la clé
-- "service role" (qui contourne RLS), peut écrire ces lignes — même
-- principe que generations_used sur profiles.

-- 5. Détection de lacunes : une ligne par question de QCM corrigée, pour
-- calculer le taux de réussite par thème (voir @/app/api/quiz-attempts et
-- QuizView, qui envoie ces lignes une fois le QCM validé). Même principe
-- que ai_usage_events ci-dessus : table plate par utilisateur, écrite
-- uniquement par le serveur via la clé "service role".
create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Thème inféré par le modèle à la génération du QCM (voir QuizQuestion.theme
  -- dans @/lib/types) — pas de table de thèmes séparée : un simple texte
  -- suffit pour regrouper par égalité exacte.
  theme text not null,
  question_text text not null,
  is_correct boolean not null
);

-- Migration : identifie le document/texte distillé à l'origine de cette
-- réponse (un uuid généré côté client à chaque nouvelle distillation, voir
-- @/components/notes/AiPanel) — l'analyse de lacunes est scopée à ce seul
-- document plutôt qu'à tout l'historique de l'utilisateur, pour ne jamais
-- mélanger les résultats de plusieurs PDF différents. Nullable : les lignes
-- enregistrées avant l'ajout de cette colonne restent en base mais ne sont
-- rattachées à aucun document (elles ne remonteront simplement plus dans
-- aucune analyse, jamais besoin de les corriger).
alter table public.quiz_answers add column if not exists distillation_id text;

create index if not exists quiz_answers_user_id_distillation_id_idx
  on public.quiz_answers (user_id, distillation_id);

alter table public.quiz_answers enable row level security;

create policy "Un utilisateur voit ses propres réponses de QCM"
  on public.quiz_answers for select
  using (auth.uid() = user_id);

-- Aucune policy insert/update/delete : mêmes principes que ai_usage_events.

-- ═════════════════════════════════════════════════════════════════════
-- 6. Team Brain — chantier complet (étapes 1-4/4, voir plan validé avec
-- l'utilisateur). Schéma + RLS (étape 1), pipeline d'indexation (étape 2,
-- voir @/lib/teamBrainIndexing.ts), recherche/génération (étape 3, voir
-- @/lib/teamBrainSearch.ts et team_brain_match_chunks ci-dessous) et
-- interface réelle (étape 4, voir @/lib/teamBrainData.ts et
-- @/components/team-brain/TeamBrain.tsx) sont en place. La démo visuelle
-- sur données mock (@/lib/teamBrainMockData) reste accessible via
-- "Explorer la démo" pour quiconque n'appartient à aucune équipe réelle —
-- aucun flux de création d'équipe/projet/invitation n'a été construit,
-- décision explicite (voir plan validé).
-- ═════════════════════════════════════════════════════════════════════

create extension if not exists vector;

-- Équipe (= "workspace" dans le vocabulaire Team Brain). Même table que le
-- futur chantier de facturation par siège (Lemon Squeezy, quantité par
-- siège) — subscription_status reste 'free' tant que la facturation n'est
-- pas branchée ; une équipe peut exister pour Team Brain sans dépendre de
-- ce chantier séparé.
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  lemonsqueezy_subscription_id text unique,
  subscription_status text not null default 'free',
  seat_count integer not null default 3,
  created_at timestamptz not null default now()
);

-- Appartenance à une équipe, avec rôle Team Brain — mêmes valeurs
-- (admin/manager/member) que l'interface mock déjà construite
-- (TEAM_BRAIN_ROLE_CONFIG), pour éviter une couche de traduction à
-- l'étape 4.
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade, -- nul tant qu'invité non lié
  invited_email text,
  role text not null default 'member' check (role in ('admin', 'manager', 'member')),
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (team_id, user_id)
);

-- Projet/dossier au sein d'une équipe.
create table if not exists public.team_brain_projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  emoji text,
  color text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- Qui a accès à quel projet. Un membre "admin" voit tous les projets de
-- son équipe via son rôle (voir team_brain_can_access_project ci-dessous),
-- sans avoir besoin d'une ligne ici pour chaque projet.
create table if not exists public.team_brain_project_members (
  project_id uuid not null references public.team_brain_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Document ajouté à un projet.
create table if not exists public.team_brain_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.team_brain_projects (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade, -- dénormalisé, voir chunks
  name text not null,
  doc_type text not null check (doc_type in ('note', 'pdf', 'doc')),
  storage_path text, -- référence vers le fichier stocké, jamais le contenu lui-même
  added_by uuid not null references auth.users (id),
  is_private boolean not null default false,
  page_count integer,
  created_at timestamptz not null default now()
);

-- L'index RAG : un morceau de document + son vecteur d'embedding (voir
-- étape 2). team_id/project_id/is_private/owner_id sont dénormalisés
-- depuis le document parent au moment de l'indexation — la recherche
-- vectorielle doit filtrer l'accès dans la MÊME requête que la recherche
-- de similarité pour rester rapide, et une policy RLS qui ne référence
-- qu'une seule table est plus simple à vérifier correcte qu'une policy
-- dépendant d'une jointure sur plusieurs tables. Conséquence à tester : si
-- un document passe de partagé à privé, ses chunks déjà indexés doivent
-- être mis à jour en même temps (voir étape 2), sinon incohérence = fuite
-- potentielle.
create table if not exists public.team_brain_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.team_brain_documents (id) on delete cascade,
  project_id uuid not null references public.team_brain_projects (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  is_private boolean not null default false,
  owner_id uuid not null references auth.users (id),
  chunk_text text not null,
  page_number integer,
  embedding vector (1024), -- dimension du modèle Voyage retenu à l'étape 2
  created_at timestamptz not null default now()
);

create index if not exists team_brain_chunks_embedding_idx
  on public.team_brain_chunks using hnsw (embedding vector_cosine_ops);

-- Fonctions d'aide pour les policies RLS ci-dessous — source unique de la
-- logique d'accès (au lieu de dupliquer la même sous-requête dans chaque
-- policy), et plus faciles à couvrir par les tests de confidentialité
-- (voir tests/team-brain-rls.test.ts) puisqu'elles isolent la décision
-- "cet utilisateur peut-il accéder à X ?" en un seul endroit. security
-- definer + search_path fixé : nécessaire pour lire team_members/
-- team_brain_projects malgré leur propre RLS, sans s'exposer à un
-- détournement de search_path.
create or replace function public.team_brain_is_active_member(p_team_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_user_id and status = 'active'
  );
$$;

create or replace function public.team_brain_is_admin(p_team_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_user_id and status = 'active' and role = 'admin'
  );
$$;

create or replace function public.team_brain_can_access_project(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_brain_projects p
    where p.id = p_project_id
      and public.team_brain_is_active_member(p.team_id, p_user_id)
      and (
        public.team_brain_is_admin(p.team_id, p_user_id)
        or exists (
          select 1 from public.team_brain_project_members pm
          where pm.project_id = p.id and pm.user_id = p_user_id
        )
      )
  );
$$;

alter table public.teams enable row level security;
create policy "Un membre actif voit son équipe"
  on public.teams for select
  using (public.team_brain_is_active_member(id, auth.uid()));

alter table public.team_members enable row level security;
create policy "Un admin voit tous les membres de son équipe"
  on public.team_members for select
  using (public.team_brain_is_admin(team_id, auth.uid()));
create policy "Un membre voit sa propre ligne"
  on public.team_members for select
  using (user_id = auth.uid());

alter table public.team_brain_projects enable row level security;
create policy "Projet visible selon rôle/affectation"
  on public.team_brain_projects for select
  using (public.team_brain_can_access_project(id, auth.uid()));

alter table public.team_brain_project_members enable row level security;
create policy "Visible si le projet est accessible"
  on public.team_brain_project_members for select
  using (public.team_brain_can_access_project(project_id, auth.uid()));

alter table public.team_brain_documents enable row level security;
create policy "Document visible si projet accessible et (partagé ou propriétaire)"
  on public.team_brain_documents for select
  using (
    public.team_brain_can_access_project(project_id, auth.uid())
    and (is_private = false or added_by = auth.uid())
  );

alter table public.team_brain_chunks enable row level security;
create policy "Chunk visible si projet accessible et (partagé ou propriétaire)"
  on public.team_brain_chunks for select
  using (
    public.team_brain_can_access_project(project_id, auth.uid())
    and (is_private = false or owner_id = auth.uid())
  );

-- Aucune policy insert/update/delete sur les 6 tables ci-dessus : les
-- écritures passeront par le serveur (étapes 2-4), qui applique ses
-- propres vérifications d'autorisation avant d'écrire via la clé
-- "service role" — même principe que le reste du schéma.

-- Recherche par similarité vectorielle (étape 3/4). Volontairement SANS
-- "security definer" (contrairement aux fonctions d'aide RLS ci-dessus) :
-- exécutée avec les droits de l'appelant, elle hérite donc automatiquement
-- des policies RLS déjà posées et testées sur team_brain_chunks et
-- team_brain_documents (document privé, membre retiré, isolation
-- inter-équipes...) — aucune logique d'accès à dupliquer ni à re-vérifier
-- séparément. Appelée uniquement via le client authentifié de session côté
-- serveur (jamais la clé service_role, qui contournerait RLS et annulerait
-- cette garantie).
create or replace function public.team_brain_match_chunks(
  p_project_id uuid,
  p_query_embedding vector (1024),
  p_match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  chunk_text text,
  page_number integer,
  similarity float
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.name as document_name,
    c.chunk_text,
    c.page_number,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.team_brain_chunks c
  join public.team_brain_documents d on d.id = c.document_id
  where c.project_id = p_project_id
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$$;

grant execute on function public.team_brain_match_chunks(uuid, vector, integer) to authenticated;

-- Trousseau d'une équipe (étape 4/4, vue Workspace) : email + rôle/statut de
-- chaque membre, pour afficher un nombre de membres et des avatars fiables.
-- Nécessaire car les policies RLS de team_members (étape 1) et profiles
-- n'autorisent respectivement qu'un admin à voir tous les membres, et
-- chacun à voir uniquement sa propre ligne de profil — un membre normal ne
-- peut donc reconstituer ni le trousseau ni les emails de ses coéquipiers
-- par une simple lecture. "security definer" contourne ça, mais seulement
-- pour les membres actifs de CETTE équipe (vérifié en interne via
-- team_brain_is_active_member) : la clause where filtre tout le reste,
-- renvoyant un ensemble vide plutôt qu'une erreur pour qui n'est pas
-- membre. Réutilisable pour la vue Membres (dernière sous-étape).
create or replace function public.team_brain_team_roster(p_team_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  status text,
  joined_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select tm.user_id, p.email, tm.role, tm.status, tm.joined_at
  from public.team_members tm
  left join public.profiles p on p.id = tm.user_id
  where tm.team_id = p_team_id
    and public.team_brain_is_active_member(p_team_id, auth.uid());
$$;

grant execute on function public.team_brain_team_roster(uuid) to authenticated;

-- 7. Jetons supplémentaires à la carte (achat one-time via Paddle, voir
-- /api/paddle/webhook et @/lib/aiUsage) — réservé aux abonnés Essentiel/
-- Étudiant. purchased_jetons_balance persiste indéfiniment d'un mois à
-- l'autre (jamais remis à zéro automatiquement, contrairement au plafond
-- mensuel de base qui, lui, se recalcule à partir de ai_usage_events) : un
-- abonné peut cumuler son nouveau plafond mensuel avec un solde acheté non
-- utilisé le mois précédent.
alter table public.profiles add column if not exists purchased_jetons_balance integer not null default 0;

-- Historique des achats de jetons, avec paddle_transaction_id UNIQUE :
-- garantit qu'un webhook Paddle livré plusieurs fois pour le même achat
-- (comportement normal, pas une erreur) ne crédite jamais deux fois le
-- solde — voir son usage dans /api/paddle/webhook.
create table if not exists public.jeton_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  paddle_transaction_id text unique not null,
  jetons_granted integer not null,
  created_at timestamptz not null default now()
);

alter table public.jeton_purchases enable row level security;
create policy "jeton_purchases_select_own"
  on public.jeton_purchases for select
  using (auth.uid() = user_id);

-- Incrémente/décrémente purchased_jetons_balance en une seule instruction
-- SQL (atomique), pour éviter une course lecture-puis-écriture entre deux
-- requêtes concurrentes (deux webhooks d'achat, ou deux générations lancées
-- en parallèle depuis deux onglets) — jamais de simple `select` puis
-- `update` séparés côté application pour ces deux opérations. Appelées
-- uniquement via le client admin (service_role, qui contourne déjà RLS) :
-- pas besoin de security definer, seule l'atomicité de l'expression compte
-- ici.
create or replace function public.increment_purchased_jetons(p_user_id uuid, p_amount integer)
returns void
language sql
as $$
  update public.profiles
  set purchased_jetons_balance = purchased_jetons_balance + p_amount
  where id = p_user_id;
$$;

-- Décrémente sans jamais passer sous 0 (greatest) — un solde acheté ne
-- peut pas devenir négatif même en cas de calcul de coût imprécis sur un
-- appel Claude particulièrement volumineux.
create or replace function public.debit_purchased_jetons(p_user_id uuid, p_amount integer)
returns void
language sql
as $$
  update public.profiles
  set purchased_jetons_balance = greatest(purchased_jetons_balance - p_amount, 0)
  where id = p_user_id;
$$;
