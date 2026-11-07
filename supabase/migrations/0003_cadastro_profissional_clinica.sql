create or replace function public.criar_profissional(p_nome text, p_profissao text, p_registro text, p_uf text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_codigo text;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select codigo_convite into v_codigo from public.professionals where user_id = auth.uid();
  if v_codigo is not null then return v_codigo; end if;
  v_codigo := public.gerar_codigo(p_nome);
  insert into public.professionals (user_id, nome, profissao, registro_conselho, uf, codigo_convite)
  values (auth.uid(), p_nome, p_profissao, p_registro, nullif(upper(p_uf), ''), v_codigo);
  return v_codigo;
end $$;

create or replace function public.criar_clinica(p_nome text, p_cnpj text, p_meu_nome text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  insert into public.clinics (nome, cnpj, codigo_convite) values (p_nome, nullif(p_cnpj, ''), public.gerar_codigo(p_nome)) returning id into v_id;
  insert into public.clinic_members (clinic_id, user_id, papel, nome) values (v_id, auth.uid(), 'admin', coalesce(p_meu_nome, ''));
  return v_id;
end $$;

-- Equipe da clínica com contagem de pacientes por profissional
create or replace function public.clinica_equipe(p_clinic uuid)
returns table (user_id uuid, nome text, especialidade text, papel papel_clinica, pacientes bigint, alertas bigint)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.nome, coalesce(m.especialidade, p.profissao), m.papel,
         case when m.papel = 'recepcao' then null else (select count(*) from public.sharing_permissions s where s.profissional_id = p.id and s.revogado_em is null and (s.expira_em is null or s.expira_em > now())) end,
         case when m.papel = 'recepcao' then null else (select count(*) from public.sharing_permissions s join public.symptoms x on x.user_id = s.paciente_id
            where s.profissional_id = p.id and s.revogado_em is null and 'sintomas' = any (s.modulos) and x.alerta_disparado and x.registrado_em >= now() - interval '7 days') end
    from public.clinic_members m left join public.professionals p on p.user_id = m.user_id
   where m.clinic_id = p_clinic and p_clinic in (select public.minhas_clinicas())
   order by m.papel, m.nome;
$$;

revoke execute on function public.criar_profissional, public.criar_clinica, public.clinica_equipe from anon, public;
grant execute on function public.criar_profissional, public.criar_clinica, public.clinica_equipe to authenticated;
