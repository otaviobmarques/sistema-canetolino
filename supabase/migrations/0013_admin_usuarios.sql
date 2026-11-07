-- Painel Admin · gestão de usuários (cadastrar, trocar senha, bloquear e excluir).
-- A listagem mostra só dados de conta (nome, e-mail, tipo, datas), nunca dados de saúde.
-- Criar, bloquear e excluir passam pela Edge Function `admin-usuarios`, que usa a API de administração do Auth.

create or replace function public.admin_usuarios(p_busca text default '', p_tipo text default '')
returns table (id uuid, email text, nome text, tipo text, detalhe text, criado_em timestamptz, ultimo_acesso timestamptz,
               email_confirmado boolean, bloqueado boolean, plano text)
language sql stable security definer set search_path = '' as $$
  with base as (
    select u.id, u.email::text email, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null conf,
           coalesce(u.banned_until > now(), false) ban,
           a.nome a_nome, p.nome p_nome, p.profissao, cm.nome cm_nome, c.nome c_nome, pr.nome pr_nome, pr.plano
      from auth.users u
      left join public.platform_admins a on a.user_id = u.id
      left join public.professionals p on p.user_id = u.id
      left join lateral (select m.nome, m.clinic_id from public.clinic_members m where m.user_id = u.id limit 1) cm on true
      left join public.clinics c on c.id = cm.clinic_id
      left join public.profiles pr on pr.user_id = u.id
  ), tipado as (
    select b.*, case when a_nome is not null then 'admin' when p_nome is not null then 'profissional'
                     when c_nome is not null then 'clinica' else 'paciente' end tipo
      from base b
  )
  select id, email, coalesce(nullif(a_nome, ''), nullif(p_nome, ''), nullif(cm_nome, ''), nullif(pr_nome, ''), '') nome, tipo,
         case tipo when 'profissional' then profissao when 'clinica' then c_nome else null end detalhe,
         created_at, last_sign_in_at, conf, ban, case when tipo = 'paciente' then plano end
    from tipado
   where public.eh_admin()
     and (coalesce(p_tipo, '') = '' or tipo = p_tipo)
     and (coalesce(p_busca, '') = '' or email ilike '%' || p_busca || '%'
          or coalesce(a_nome, p_nome, cm_nome, pr_nome, '') ilike '%' || p_busca || '%')
   order by created_at desc
   limit 500;
$$;
revoke execute on function public.admin_usuarios from anon, public;
grant execute on function public.admin_usuarios to authenticated;

-- encerra as sessões abertas de quem foi bloqueado (chamada só pelo servidor)
create or replace function public.encerrar_sessoes(p_user uuid) returns void language sql security definer set search_path = '' as $$
  delete from auth.sessions where user_id = p_user;
$$;
revoke execute on function public.encerrar_sessoes from anon, authenticated, public;

-- clínicas que ficaram sem ninguém depois de uma exclusão
create or replace function public.limpar_clinicas_vazias() returns void language sql security definer set search_path = '' as $$
  delete from public.clinics c where not exists (select 1 from public.clinic_members m where m.clinic_id = c.id);
$$;
revoke execute on function public.limpar_clinicas_vazias from anon, authenticated, public;
