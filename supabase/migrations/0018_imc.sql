-- IMC: o profissional recebe a altura junto com o peso (só quando o módulo "peso" está autorizado).
drop function if exists public.pacientes_do_profissional();
create function public.pacientes_do_profissional()
returns table (paciente_id uuid, nome text, peso_inicial_kg numeric, meta_proteina_g integer, meta_agua_ml integer, modulos public.modulo[], expira_em timestamptz, criado_em timestamptz, altura_cm integer)
language sql stable security definer set search_path = '' as $$
  select s.paciente_id, pr.nome, case when 'peso' = any (s.modulos) then pr.peso_inicial_kg end, pr.meta_proteina_g, pr.meta_agua_ml, s.modulos, s.expira_em, s.created_at,
         case when 'peso' = any (s.modulos) then pr.altura_cm end
    from public.sharing_permissions s join public.profiles pr on pr.user_id = s.paciente_id
   where public.aal2() and s.profissional_id = public.meu_profissional()
     and s.revogado_em is null and (s.expira_em is null or s.expira_em > now())
   order by pr.nome;
$$;
revoke execute on function public.pacientes_do_profissional from anon, public;
grant execute on function public.pacientes_do_profissional to authenticated;
