-- O administrador da plataforma passa a ver (só ler) os dados de saúde dos pacientes, a pedido do responsável.
-- Cada abertura dos dados de um paciente fica no histórico de acessos que o próprio paciente vê no app.
create or replace function public.pode_ler(p_paciente uuid, p_modulo public.modulo) returns boolean language sql stable security definer set search_path = '' as $$
  select p_paciente = auth.uid() or public.eh_admin() or (
    public.aal2() and exists (
      select 1 from public.sharing_permissions s
      where s.paciente_id = p_paciente
        and p_modulo = any (s.modulos)
        and s.revogado_em is null
        and (s.expira_em is null or s.expira_em > now())
        and (
          s.profissional_id = public.meu_profissional()
          or s.clinic_id in (select public.minhas_clinicas(array['admin','profissional']::public.papel_clinica[]))
        )
    )
  );
$$;

create policy admin_le on profiles for select to authenticated using (public.eh_admin());
create policy admin_le on progress_photos for select to authenticated using (public.eh_admin());
create policy admin_le on pen_inventory for select to authenticated using (public.eh_admin());
create policy admin_le on pen_purchases for select to authenticated using (public.eh_admin());
create policy admin_le on user_foods for select to authenticated using (public.eh_admin());
create policy admin_le on consent_records for select to authenticated using (public.eh_admin());
create policy admin_le on audit_logs for select to authenticated using (public.eh_admin());
create policy admin_le on assinaturas for select to authenticated using (public.eh_admin());
create policy admin_le on medications for select to authenticated using (public.eh_admin());
create policy evolucao_admin_le on storage.objects for select to authenticated using (bucket_id = 'evolucao' and public.eh_admin());

create or replace function public.admin_registrar_acesso(p_paciente uuid, p_acao text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'sem acesso'; end if;
  insert into public.audit_logs (ator_id, ator_nome, acao, paciente_id)
  values (auth.uid(), 'Equipe Canetolino (administrador)', left(p_acao, 200), p_paciente);
end $$;
revoke execute on function public.admin_registrar_acesso from anon, public;
grant execute on function public.admin_registrar_acesso to authenticated;
