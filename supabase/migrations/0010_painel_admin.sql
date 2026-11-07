-- Administradores da plataforma (equipe Canetolino). Não leem dados de saúde.
-- O usuário administrador é criado direto no banco (e-mail admin@canetolino.com.br), nunca pelo repositório.
create table platform_admins (
  user_id uuid primary key references auth.users on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;
create policy proprio on platform_admins for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.eh_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select public.aal2() and exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- ao_criar_usuario: contas com metadata tipo = 'admin' não viram paciente (ver migração aplicada no projeto)

create or replace function public.admin_resumo() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare inicio_mes timestamptz := date_trunc('month', now());
begin
  if not public.eh_admin() then raise exception 'sem acesso'; end if;
  return jsonb_build_object(
    'pacientes', (select count(*) from public.profiles),
    'pacientes_ativos_7d', (select count(distinct user_id) from (
        select user_id from public.meals where horario >= now() - interval '7 days'
        union select user_id from public.hydration_records where registrado_em >= now() - interval '7 days'
        union select user_id from public.applications where aplicado_em >= now() - interval '7 days'
        union select user_id from public.weight_records where registrado_em >= now() - interval '7 days') x),
    'premium', (select count(*) from public.profiles where plano = 'premium'),
    'profissionais', (select count(*) from public.professionals),
    'profissionais_pendentes', (select count(*) from public.professionals where not verificado),
    'clinicas', (select count(*) from public.clinics),
    'compartilhamentos_ativos', (select count(*) from public.sharing_permissions where revogado_em is null and (expira_em is null or expira_em > now())),
    'aparelhos_com_lembrete', (select count(*) from public.push_subscriptions),
    'ia_chamadas_mes', (select count(*) from public.ai_usage where em >= inicio_mes),
    'ia_tokens_entrada_mes', (select coalesce(sum(tokens_entrada), 0) from public.ai_usage where em >= inicio_mes),
    'ia_tokens_saida_mes', (select coalesce(sum(tokens_saida), 0) from public.ai_usage where em >= inicio_mes),
    'alimentos', (select count(*) from public.foods)
  );
end $$;

create or replace function public.admin_profissionais()
returns table (id uuid, nome text, profissao text, registro text, uf text, email text, codigo text, verificado boolean, pacientes bigint, criado_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nome, p.profissao, p.registro_conselho, p.uf, u.email::text, p.codigo_convite, p.verificado,
         (select count(*) from public.sharing_permissions s where s.profissional_id = p.id and s.revogado_em is null and (s.expira_em is null or s.expira_em > now())),
         p.created_at
    from public.professionals p join auth.users u on u.id = p.user_id
   where public.eh_admin()
   order by p.verificado, p.created_at desc;
$$;

create or replace function public.admin_verificar_profissional(p_id uuid, p_verificado boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'sem acesso'; end if;
  update public.professionals set verificado = p_verificado where id = p_id;
end $$;

create or replace function public.admin_clinicas()
returns table (id uuid, nome text, cnpj text, codigo text, membros bigint, pacientes bigint, criado_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.nome, c.cnpj, c.codigo_convite,
         (select count(*) from public.clinic_members m where m.clinic_id = c.id),
         (select count(*) from public.sharing_permissions s where s.clinic_id = c.id and s.revogado_em is null and (s.expira_em is null or s.expira_em > now())),
         c.created_at
    from public.clinics c
   where public.eh_admin()
   order by c.created_at desc;
$$;

revoke execute on function public.eh_admin, public.admin_resumo, public.admin_profissionais, public.admin_verificar_profissional, public.admin_clinicas from anon, public;
grant execute on function public.eh_admin, public.admin_resumo, public.admin_profissionais, public.admin_verificar_profissional, public.admin_clinicas to authenticated;
