-- Schéma Distill : comptes utilisateurs + abonnement Stripe
-- À exécuter une fois dans Supabase : Dashboard > SQL Editor > New query > coller > Run

-- 1. Table de profil, une ligne par utilisateur (liée à auth.users géré par Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  generations_used integer not null default 0,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  -- 'free' tant que l'utilisateur n'a jamais payé, sinon le statut Stripe
  -- brut ('active', 'trialing', 'past_due', 'canceled', ...).
  subscription_status text not null default 'free',
  created_at timestamptz not null default now()
);

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
