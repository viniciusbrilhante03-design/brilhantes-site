-- Brilhante's Imóveis — estrutura do banco (cole tudo no SQL Editor do Supabase e clique em Run).
-- Pode rodar de novo sem problema: só cria o que ainda não existe.

-- 1) Tabela única de dados do sistema (cada registro = coleção + id + conteúdo)
create table if not exists public.docs (
  collection text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);
create index if not exists docs_updated_at_idx on public.docs (updated_at);

create or replace function public.docs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.docs_touch();

-- 2) Perfis: quem é gestor (admin) e quem é corretor
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  role       text not null default 'corretor' check (role in ('admin', 'corretor')),
  nome       text,
  usuario_id text,
  created_at timestamptz not null default now()
);

-- E-mails de gestor (acesso total). Para adicionar outro gestor no futuro, inclua o e-mail aqui e rode de novo.
create or replace function public.emails_gestores() returns text[]
language sql immutable as $$
  select array['viniciusbrilhante03@gmail.com']::text[]
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, lower(new.email), case when lower(new.email) = any (public.emails_gestores()) then 'admin' else 'corretor' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários que já existiam antes deste script
insert into public.profiles (id, email, role)
select u.id, lower(u.email), case when lower(u.email) = any (public.emails_gestores()) then 'admin' else 'corretor' end
from auth.users u
on conflict (id) do update set role = case when excluded.role = 'admin' then 'admin' else public.profiles.role end;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- 3) Regras de acesso (RLS): gestor vê e altera tudo; corretor só lê o próprio painel e as páginas públicas
alter table public.docs enable row level security;
alter table public.profiles enable row level security;

drop policy if exists docs_gestor on public.docs;
create policy docs_gestor on public.docs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists docs_corretor_leitura on public.docs;
create policy docs_corretor_leitura on public.docs for select to authenticated
  using (collection = 'publico' or (collection = 'portal' and id = auth.uid()::text));

drop policy if exists profiles_leitura on public.profiles;
create policy profiles_leitura on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

revoke all on public.docs, public.profiles from anon;
grant select, insert, update, delete on public.docs to authenticated;
grant select on public.profiles to authenticated;

-- 4) Arquivos (fotos, PDFs, comprovantes): pasta "arquivos"
insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', true)
on conflict (id) do update set public = true;

drop policy if exists arquivos_gestor_ler on storage.objects;
create policy arquivos_gestor_ler on storage.objects for select to authenticated
  using (bucket_id = 'arquivos' and public.is_admin());
drop policy if exists arquivos_gestor_enviar on storage.objects;
create policy arquivos_gestor_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'arquivos' and public.is_admin());
drop policy if exists arquivos_gestor_alterar on storage.objects;
create policy arquivos_gestor_alterar on storage.objects for update to authenticated
  using (bucket_id = 'arquivos' and public.is_admin());
drop policy if exists arquivos_gestor_apagar on storage.objects;
create policy arquivos_gestor_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'arquivos' and public.is_admin());

-- 5) Google Agenda (tokens de cada usuário; só o servidor acessa)
create table if not exists public.google_tokens (
  usuario       uuid primary key references auth.users (id) on delete cascade,
  email         text,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  connected_at  timestamptz default now()
);
alter table public.google_tokens enable row level security;
revoke all on public.google_tokens from anon, authenticated;
