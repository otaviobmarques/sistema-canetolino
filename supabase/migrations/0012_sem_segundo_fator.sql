-- Verificação em duas etapas retirada dos painéis (Pro, Clinic e Admin), a pedido.
-- Todas as regras (pode_ler, políticas de sharing_permissions, eh_admin, funções da clínica e do profissional)
-- passam por aal2(); agora basta estar logado. Para voltar a exigir o segundo fator, restaure:
--   select coalesce((auth.jwt() ->> 'aal') = 'aal2', false);
create or replace function public.aal2() returns boolean language sql stable set search_path = '' as $$
  select auth.uid() is not null;
$$;
