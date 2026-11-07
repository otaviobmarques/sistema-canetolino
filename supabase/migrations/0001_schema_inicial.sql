-- Canetolino · esquema inicial (seção 5 do descritivo técnico)
-- Dados de saúde: o dono lê e escreve; profissional e clínica só leem com permissão ativa,
-- por módulo, dentro do prazo e com sessão em dois fatores (aal2).

create type modulo as enum ('peso', 'nutricao', 'aplicacoes', 'sintomas', 'bemestar');
create type papel_clinica as enum ('admin', 'profissional', 'recepcao');
create type origem as enum ('manual', 'ia_estimativa', 'integracao');

/* ============================ Contas ============================ */
create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  nome text not null default '',
  email text,
  data_nascimento date,
  altura_cm int,
  peso_inicial_kg numeric(5,2),
  meta_peso_kg numeric(5,2),
  meta_proteina_g int not null default 100,
  meta_agua_ml int not null default 2000,
  preferencias jsonb not null default '[]'::jsonb,
  plano text not null default 'basico' check (plano in ('basico', 'premium')),
  config jsonb not null default '{}'::jsonb,
  onboarding_feito boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table professionals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  nome text not null,
  profissao text not null,
  registro_conselho text not null,
  uf char(2),
  codigo_convite text not null unique,
  verificado boolean not null default false, -- verificação manual no MVP
  created_at timestamptz not null default now()
);

create table clinics (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  codigo_convite text not null unique,
  created_at timestamptz not null default now()
);

create table clinic_members (
  clinic_id uuid not null references clinics on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  papel papel_clinica not null,
  nome text not null default '',
  especialidade text,
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table clinic_invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics on delete cascade,
  email text not null,
  tipo text not null check (tipo in ('profissional', 'paciente')),
  papel papel_clinica,
  criado_por uuid references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  aceito_em timestamptz
);

create table invite_codes (
  code text primary key,
  profissional_id uuid references professionals on delete cascade,
  clinic_id uuid references clinics on delete cascade,
  enviado_para text,
  expira_em timestamptz not null default now() + interval '7 days',
  usado_em timestamptz,
  created_at timestamptz not null default now(),
  check ((profissional_id is null) <> (clinic_id is null))
);

create table sharing_permissions (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references auth.users on delete cascade,
  profissional_id uuid references professionals on delete cascade,
  clinic_id uuid references clinics on delete cascade,
  modulos modulo[] not null check (cardinality(modulos) > 0),
  finalidade text not null default 'Acompanhamento do tratamento',
  expira_em timestamptz,
  revogado_em timestamptz,
  created_at timestamptz not null default now(),
  check ((profissional_id is null) <> (clinic_id is null))
);
create index on sharing_permissions (paciente_id);
create index on sharing_permissions (profissional_id) where revogado_em is null;
create index on sharing_permissions (clinic_id) where revogado_em is null;

create table consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null check (tipo in ('termos', 'ia', 'compartilhamento', 'integracao')),
  versao_texto text not null,
  detalhe text,
  aceito_em timestamptz not null default now(),
  revogado_em timestamptz
);

create table audit_logs (
  id bigint generated always as identity primary key,
  ator_id uuid not null,
  ator_nome text not null,
  acao text not null,
  paciente_id uuid not null references auth.users on delete cascade,
  em timestamptz not null default now()
);
create index on audit_logs (paciente_id, em desc);

/* ============================ Saúde ============================ */
create table medications (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  principio_ativo text not null,
  nome_comercial text,
  status text not null default 'ativo',
  source origem not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table prescriptions (
  id uuid primary key,
  medication_id uuid not null references medications on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  dose_texto text not null, -- texto livre da receita, nunca calculado
  frequencia text default 'semanal'
);
create table application_schedules (
  id uuid primary key,
  medication_id uuid not null references medications on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  horario time not null
);
create table applications (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  aplicado_em timestamptz not null,
  local text not null check (local in ('Abdômen esq.', 'Abdômen dir.', 'Coxa esq.', 'Coxa dir.', 'Braço esq.', 'Braço dir.')),
  observacao text,
  source origem not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table pen_inventory (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  nome text, lote text, validade text, quantidade int not null default 0
);
create table pen_purchases (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  data timestamptz not null, valor_centavos int not null default 0, quantidade int not null default 1
);
create table foods (
  id text primary key,
  nome text not null,
  fonte text not null check (fonte in ('TACO', 'TBCA', 'rótulo')),
  versao_tabela text not null,
  preparo text,
  proteina_100g numeric not null,
  energia_100g numeric not null
);
create table meals (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  tipo text,
  horario timestamptz not null,
  origem origem not null default 'manual',
  versao_tabela text,
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table meal_items (
  id bigint generated always as identity primary key,
  meal_id uuid not null references meals on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  food_id text references foods,
  nome text not null,
  porcao_g numeric not null,
  porcao_texto text,
  proteina_g numeric not null,
  energia_kcal numeric,
  origem origem not null
);
create table hydration_records (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  ml int not null check (ml > 0),
  registrado_em timestamptz not null default now()
);
create table weight_records (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  peso_kg numeric(5,2) not null,
  registrado_em timestamptz not null default now()
);
create table symptoms (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  sintomas text[] not null,
  intensidade smallint not null check (intensidade between 1 and 5),
  observacao text,
  alerta_disparado boolean not null default false,
  registrado_em timestamptz not null default now()
);
create table workouts (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null,
  duracao_min int not null,
  forca boolean not null default false,
  registrado_em timestamptz not null default now()
);
create index on applications (user_id, aplicado_em desc);
create index on meals (user_id, horario desc);
create index on meal_items (meal_id);
create index on hydration_records (user_id, registrado_em desc);
create index on weight_records (user_id, registrado_em desc);
create index on symptoms (user_id, registrado_em desc);
create index on workouts (user_id, registrado_em desc);

/* ============================ Funções auxiliares ============================ */
create or replace function public.aal2() returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false);
$$;

create or replace function public.minhas_clinicas(p_papeis papel_clinica[] default array['admin','profissional','recepcao']::papel_clinica[])
returns setof uuid language sql stable security definer set search_path = '' as $$
  select clinic_id from public.clinic_members where user_id = auth.uid() and papel = any (p_papeis);
$$;

create or replace function public.meu_profissional() returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.professionals where user_id = auth.uid();
$$;

-- Quem está logado pode ler o módulo deste paciente?
create or replace function public.pode_ler(p_paciente uuid, p_modulo modulo)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_paciente = auth.uid() or (
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

create or replace function public.gerar_codigo(p_nome text) returns text language plpgsql set search_path = '' as $$
declare
  base text := upper(left(regexp_replace(translate(regexp_replace(coalesce(p_nome, ''), '^\s*(dra?\.?|cl[ií]nica)\s+', '', 'i'),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'), '[^A-Za-z]', '', 'g'), 3));
  c text;
begin
  if length(base) < 3 then base := rpad(base, 3, 'X'); end if;
  loop
    c := base || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.professionals where codigo_convite = c)
          and not exists (select 1 from public.clinics where codigo_convite = c)
          and not exists (select 1 from public.invite_codes where code = c);
  end loop;
  return c;
end $$;

/* ============================ Novo usuário ============================ */
-- metadata.tipo: 'paciente' (padrão), 'profissional' ou 'clinica'
create or replace function public.ao_criar_usuario() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_clinica uuid;
begin
  if m ->> 'tipo' = 'profissional' then
    insert into public.professionals (user_id, nome, profissao, registro_conselho, uf, codigo_convite)
    values (new.id, coalesce(m ->> 'nome', ''), coalesce(m ->> 'profissao', 'Profissional'), coalesce(m ->> 'registro', ''),
            nullif(upper(m ->> 'uf'), ''), public.gerar_codigo(m ->> 'nome'));
  elsif m ->> 'tipo' = 'clinica' then
    insert into public.clinics (nome, cnpj, codigo_convite)
    values (coalesce(m ->> 'clinica', 'Minha clínica'), m ->> 'cnpj', public.gerar_codigo(m ->> 'clinica'))
    returning id into v_clinica;
    insert into public.clinic_members (clinic_id, user_id, papel, nome, especialidade)
    values (v_clinica, new.id, 'admin', coalesce(m ->> 'nome', ''), m ->> 'especialidade');
  else
    insert into public.profiles (user_id, nome, email) values (new.id, coalesce(m ->> 'nome', ''), new.email)
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.ao_criar_usuario();

/* ============================ RLS ============================ */
alter table profiles enable row level security;
alter table professionals enable row level security;
alter table clinics enable row level security;
alter table clinic_members enable row level security;
alter table clinic_invites enable row level security;
alter table invite_codes enable row level security;
alter table sharing_permissions enable row level security;
alter table consent_records enable row level security;
alter table audit_logs enable row level security;
alter table foods enable row level security;

create policy dono on profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dono on professionals for select to authenticated using (user_id = (select auth.uid()));
create policy dono_edita on professionals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and verificado = false);
create policy membros_veem on clinics for select to authenticated using (id in (select public.minhas_clinicas()));
create policy admin_edita on clinics for update to authenticated using (id in (select public.minhas_clinicas(array['admin']::papel_clinica[])));
create policy membros_veem on clinic_members for select to authenticated using (clinic_id in (select public.minhas_clinicas()));
create policy admin_gerencia on clinic_members for update to authenticated using (clinic_id in (select public.minhas_clinicas(array['admin']::papel_clinica[])) and user_id <> (select auth.uid()));
create policy admin_remove on clinic_members for delete to authenticated using (clinic_id in (select public.minhas_clinicas(array['admin']::papel_clinica[])) and user_id <> (select auth.uid()));
create policy equipe_convida on clinic_invites for all to authenticated
  using (clinic_id in (select public.minhas_clinicas()))
  with check (clinic_id in (select public.minhas_clinicas()) and (tipo = 'paciente' or clinic_id in (select public.minhas_clinicas(array['admin']::papel_clinica[]))));
create policy dono on invite_codes for all to authenticated
  using (profissional_id = (select public.meu_profissional()) or clinic_id in (select public.minhas_clinicas()))
  with check (profissional_id = (select public.meu_profissional()) or clinic_id in (select public.minhas_clinicas()));
create policy paciente_ve on sharing_permissions for select to authenticated using (paciente_id = (select auth.uid()));
create policy profissional_ve on sharing_permissions for select to authenticated using (public.aal2() and profissional_id = (select public.meu_profissional()));
create policy clinica_ve on sharing_permissions for select to authenticated using (public.aal2() and clinic_id in (select public.minhas_clinicas(array['admin','profissional']::papel_clinica[])));
create policy dono_le on consent_records for select to authenticated using (user_id = (select auth.uid()));
create policy dono_insere on consent_records for insert to authenticated with check (user_id = (select auth.uid())); -- histórico imutável
create policy paciente_ve on audit_logs for select to authenticated using (paciente_id = (select auth.uid()));
create policy paciente_registra on audit_logs for insert to authenticated with check (paciente_id = (select auth.uid()) and ator_id = (select auth.uid()));
create policy leitura on foods for select to anon, authenticated using (true);

do $$
declare t text; m text;
begin
  for t, m in select * from (values
    ('medications', 'aplicacoes'), ('prescriptions', 'aplicacoes'), ('application_schedules', 'aplicacoes'), ('applications', 'aplicacoes'),
    ('pen_inventory', null), ('pen_purchases', null),
    ('meals', 'nutricao'), ('meal_items', 'nutricao'), ('hydration_records', 'nutricao'),
    ('weight_records', 'peso'), ('symptoms', 'sintomas'), ('workouts', 'bemestar')
  ) as x(t, m) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy dono_escreve on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    if m is not null then
      execute format('create policy permitido_le on public.%I for select to authenticated using (public.pode_ler(user_id, %L::public.modulo))', t, m);
    end if;
  end loop;
end $$;

/* ============================ RPCs ============================ */
-- Identifica o código de convite (profissional, clínica ou código temporário)
create or replace function public.buscar_codigo(p_codigo text)
returns table (tipo text, alvo_id uuid, nome text, profissao text, registro text, verificado boolean)
language sql stable security definer set search_path = '' as $$
  select 'profissional', p.id, p.nome, p.profissao, p.registro_conselho || coalesce('-' || p.uf, ''), p.verificado
    from public.professionals p where p.codigo_convite = upper(trim(p_codigo))
  union all
  select 'clinica', c.id, c.nome, 'Clínica', coalesce(c.cnpj, ''), true from public.clinics c where c.codigo_convite = upper(trim(p_codigo))
  union all
  select case when i.profissional_id is not null then 'profissional' else 'clinica' end,
         coalesce(p.id, c.id), coalesce(p.nome, c.nome), coalesce(p.profissao, 'Clínica'),
         coalesce(p.registro_conselho || coalesce('-' || p.uf, ''), c.cnpj, ''), coalesce(p.verificado, true)
    from public.invite_codes i
    left join public.professionals p on p.id = i.profissional_id
    left join public.clinics c on c.id = i.clinic_id
   where i.code = upper(trim(p_codigo)) and i.usado_em is null and i.expira_em > now()
  limit 1;
$$;

create or replace function public.autorizar_compartilhamento(p_codigo text, p_modulos modulo[], p_dias int, p_finalidade text default 'Acompanhamento do tratamento')
returns uuid language plpgsql security definer set search_path = '' as $$
declare r record; v_id uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if cardinality(p_modulos) = 0 then raise exception 'escolha ao menos um módulo'; end if;
  select * into r from public.buscar_codigo(p_codigo);
  if r.alvo_id is null then raise exception 'código não encontrado ou expirado'; end if;
  update public.sharing_permissions set revogado_em = now()
   where paciente_id = auth.uid() and revogado_em is null
     and ((r.tipo = 'profissional' and profissional_id = r.alvo_id) or (r.tipo = 'clinica' and clinic_id = r.alvo_id));
  insert into public.sharing_permissions (paciente_id, profissional_id, clinic_id, modulos, finalidade, expira_em)
  values (auth.uid(), case when r.tipo = 'profissional' then r.alvo_id end, case when r.tipo = 'clinica' then r.alvo_id end,
          p_modulos, p_finalidade, case when p_dias is null or p_dias = 0 then null else now() + make_interval(days => p_dias) end)
  returning id into v_id;
  update public.invite_codes set usado_em = now() where code = upper(trim(p_codigo)) and usado_em is null;
  insert into public.consent_records (user_id, tipo, versao_texto, detalhe) values (auth.uid(), 'compartilhamento', 'share-v1.0', r.nome || ' · ' || array_to_string(p_modulos, ', '));
  insert into public.audit_logs (ator_id, ator_nome, acao, paciente_id) values (auth.uid(), 'Você', 'Autorizou ' || r.nome, auth.uid());
  return v_id;
end $$;

create or replace function public.revogar_compartilhamento(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  update public.sharing_permissions s set revogado_em = now()
   where s.id = p_id and s.paciente_id = auth.uid() and s.revogado_em is null;
  if not found then raise exception 'permissão não encontrada'; end if;
  select coalesce(p.nome, c.nome) into v_nome from public.sharing_permissions s
    left join public.professionals p on p.id = s.profissional_id left join public.clinics c on c.id = s.clinic_id where s.id = p_id;
  update public.consent_records set revogado_em = now() where user_id = auth.uid() and tipo = 'compartilhamento' and revogado_em is null and detalhe like v_nome || ' ·%';
  insert into public.audit_logs (ator_id, ator_nome, acao, paciente_id) values (auth.uid(), 'Você', 'Revogou o acesso de ' || v_nome, auth.uid());
end $$;

-- Compartilhamentos do paciente, com o nome de quem recebe
create or replace function public.meus_compartilhamentos()
returns table (id uuid, alvo_id uuid, tipo text, nome text, profissao text, registro text, modulos modulo[], expira_em timestamptz, criado_em timestamptz, revogado_em timestamptz, finalidade text)
language sql stable security definer set search_path = '' as $$
  select s.id, coalesce(s.profissional_id, s.clinic_id), case when s.profissional_id is not null then 'profissional' else 'clinica' end,
         coalesce(p.nome, c.nome), coalesce(p.profissao, 'Clínica'), coalesce(p.registro_conselho, c.cnpj, ''),
         s.modulos, s.expira_em, s.created_at, s.revogado_em, s.finalidade
    from public.sharing_permissions s
    left join public.professionals p on p.id = s.profissional_id
    left join public.clinics c on c.id = s.clinic_id
   where s.paciente_id = auth.uid()
   order by s.created_at;
$$;

-- Pacientes do profissional logado (só com permissão ativa, sessão aal2)
create or replace function public.pacientes_do_profissional()
returns table (paciente_id uuid, nome text, peso_inicial_kg numeric, meta_proteina_g int, meta_agua_ml int, modulos modulo[], expira_em timestamptz, criado_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.paciente_id, pr.nome, case when 'peso' = any (s.modulos) then pr.peso_inicial_kg end, pr.meta_proteina_g, pr.meta_agua_ml, s.modulos, s.expira_em, s.created_at
    from public.sharing_permissions s join public.profiles pr on pr.user_id = s.paciente_id
   where public.aal2() and s.profissional_id = public.meu_profissional()
     and s.revogado_em is null and (s.expira_em is null or s.expira_em > now())
   order by pr.nome;
$$;

create or replace function public.registrar_acesso(p_paciente uuid, p_acao text) returns void language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if not public.aal2() then raise exception 'segundo fator obrigatório'; end if;
  select nome into v_nome from public.professionals where user_id = auth.uid();
  if v_nome is null then
    select c.nome || ' · ' || m.nome into v_nome from public.clinic_members m join public.clinics c on c.id = m.clinic_id
     where m.user_id = auth.uid() and m.papel in ('admin', 'profissional') limit 1;
  end if;
  if not exists (
    select 1 from public.sharing_permissions s where s.paciente_id = p_paciente and s.revogado_em is null and (s.expira_em is null or s.expira_em > now())
      and (s.profissional_id = public.meu_profissional() or s.clinic_id in (select public.minhas_clinicas(array['admin','profissional']::papel_clinica[])))
  ) then raise exception 'sem permissão ativa'; end if;
  insert into public.audit_logs (ator_id, ator_nome, acao, paciente_id) values (auth.uid(), coalesce(v_nome, 'Profissional'), left(p_acao, 200), p_paciente);
end $$;

-- Clínica: o usuário entra nos convites pendentes do seu e-mail
create or replace function public.aceitar_convites_clinica() returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record; v_nome text;
begin
  v_nome := coalesce((select raw_user_meta_data ->> 'nome' from auth.users where id = auth.uid()), split_part(auth.email(), '@', 1));
  for r in select * from public.clinic_invites where lower(email) = lower(auth.email()) and tipo = 'profissional' and aceito_em is null loop
    insert into public.clinic_members (clinic_id, user_id, papel, nome, especialidade)
    values (r.clinic_id, auth.uid(), coalesce(r.papel, 'profissional'), v_nome, (select profissao from public.professionals where user_id = auth.uid()))
    on conflict (clinic_id, user_id) do nothing;
    update public.clinic_invites set aceito_em = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.clinica_visao(p_clinic uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; inicio timestamptz := now() - interval '7 days';
begin
  if not public.aal2() or p_clinic not in (select public.minhas_clinicas(array['admin','profissional']::papel_clinica[])) then
    raise exception 'sem acesso';
  end if;
  with pac as (
    select distinct s.paciente_id from public.sharing_permissions s
     where s.clinic_id = p_clinic and s.revogado_em is null and (s.expira_em is null or s.expira_em > now())
  )
  select jsonb_build_object(
    'pacientes_vinculados', (select count(*) from pac),
    'pacientes_ativos', (select count(*) from pac where exists (select 1 from public.hydration_records h where h.user_id = pac.paciente_id and h.registrado_em >= inicio)
        or exists (select 1 from public.meals m where m.user_id = pac.paciente_id and m.horario >= inicio)
        or exists (select 1 from public.weight_records w where w.user_id = pac.paciente_id and w.registrado_em >= inicio)
        or exists (select 1 from public.applications a where a.user_id = pac.paciente_id and a.aplicado_em >= inicio)),
    'aplicacoes_previstas', (select count(*) from pac where exists (select 1 from public.application_schedules x where x.user_id = pac.paciente_id)),
    'aplicacoes_registradas', (select count(distinct a.user_id) from public.applications a join pac on pac.paciente_id = a.user_id where a.aplicado_em >= inicio),
    'alertas_abertos', (select count(*) from public.symptoms x join pac on pac.paciente_id = x.user_id where x.alerta_disparado and x.registrado_em >= inicio),
    'convites_pendentes', (select count(*) from public.clinic_invites i where i.clinic_id = p_clinic and i.aceito_em is null)
  ) into v;
  return v;
end $$;

create or replace function public.clinica_pacientes(p_clinic uuid)
returns table (paciente_id uuid, nome text, modulos modulo[], expira_em timestamptz, ultimo_registro timestamptz, alerta boolean)
language sql stable security definer set search_path = '' as $$
  select s.paciente_id, pr.nome, s.modulos, s.expira_em,
         greatest((select max(registrado_em) from public.hydration_records h where h.user_id = s.paciente_id),
                  (select max(horario) from public.meals m where m.user_id = s.paciente_id),
                  (select max(aplicado_em) from public.applications a where a.user_id = s.paciente_id)),
         exists (select 1 from public.symptoms x where x.user_id = s.paciente_id and x.alerta_disparado and x.registrado_em >= now() - interval '7 days' and 'sintomas' = any (s.modulos))
    from public.sharing_permissions s join public.profiles pr on pr.user_id = s.paciente_id
   where public.aal2() and s.clinic_id = p_clinic
     and p_clinic in (select public.minhas_clinicas(array['admin','profissional']::papel_clinica[]))
     and s.revogado_em is null and (s.expira_em is null or s.expira_em > now());
$$;

-- Exclusão de conta: remove o usuário e, em cascata, todos os dados
create or replace function public.excluir_minha_conta() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on all functions in schema public from anon, public;
grant execute on function public.buscar_codigo, public.autorizar_compartilhamento, public.revogar_compartilhamento,
  public.meus_compartilhamentos, public.pacientes_do_profissional, public.registrar_acesso, public.aceitar_convites_clinica,
  public.clinica_visao, public.clinica_pacientes, public.excluir_minha_conta, public.pode_ler, public.aal2,
  public.minhas_clinicas, public.meu_profissional to authenticated;
