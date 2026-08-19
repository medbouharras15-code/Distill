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
