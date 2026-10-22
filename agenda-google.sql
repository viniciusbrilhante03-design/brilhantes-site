-- Google Agenda: guarda a ligação de cada usuário com a conta Google (só o servidor lê; ninguém pelo navegador).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar de novo sem problema.
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
