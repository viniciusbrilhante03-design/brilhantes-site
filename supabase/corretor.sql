-- Brilhante's IA: corretor pode LER a própria agenda (gravar é só pelo servidor, com validação).
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar de novo sem problema.
create or replace function public.meu_usuario() returns text
language sql stable security definer set search_path = public as $$
  select usuario_id from public.profiles where id = auth.uid()
$$;
drop policy if exists docs_corretor_agenda on public.docs;
create policy docs_corretor_agenda on public.docs for select to authenticated
  using (collection = 'agenda' and data->>'owner_id' = public.meu_usuario());
