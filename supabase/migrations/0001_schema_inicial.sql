-- Canetolino · esquema inicial (seção 5 do descritivo técnico)
-- Toda tabela de saúde tem user_id, created_at, updated_at, source e RLS que só libera
-- o dono e quem tem permissão ativa (sharing_permissions) para o módulo correspondente.

create type origem as enum ('manual', 'ia_estimativa', 'integracao');
create type modulo as enum ('peso', 'nutricao', 'aplicacoes', 'sintomas', 'bemestar');
create type papel_clinica as enum ('admin', 'profissional', 'recepcao');

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  nome text not null,
  data_nascimento date not null check (data_nascimento <= current_date - interval '18 years'),
  altura_cm int, peso_inicial_kg numeric(5,2), meta_peso_kg numeric(5,2),
  meta_proteina_g int default 100, meta_agua_ml int default 2000,
  preferencias jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table professionals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,
  nome text not null, profissao text not null, registro_conselho text not null, uf char(2),
  codigo_convite text unique, verificado boolean default false
);

create table clinics (id uuid primary key default gen_random_uuid(), nome text not null, cnpj text unique);
create table clinic_members (
  clinic_id uuid references clinics on delete cascade,
  user_id uuid references auth.users on delete cascade,
  papel papel_clinica not null,
  primary key (clinic_id, user_id)
);

create table sharing_permissions (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references auth.users on delete cascade,
  profissional_id uuid references professionals,
  clinic_id uuid references clinics,
  modulos modulo[] not null check (cardinality(modulos) > 0),
  finalidade text not null,
  expira_em timestamptz,
  revogado_em timestamptz,
  created_at timestamptz default now(),
  check ((profissional_id is null) <> (clinic_id is null))
);

create table consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null check (tipo in ('termos', 'ia', 'compartilhamento', 'integracao')),
  versao_texto text not null, aceito_em timestamptz default now(), revogado_em timestamptz
);

create table audit_logs (
  id bigserial primary key,
  ator_id uuid not null, acao text not null, alvo text, paciente_id uuid not null, em timestamptz default now()
);

-- Permissão ativa de quem está logado para ler um módulo de um paciente
create or replace function pode_ler(p_paciente uuid, p_modulo modulo)
returns boolean language sql stable security definer set search_path = public as $$
  select p_paciente = auth.uid() or exists (
    select 1 from sharing_permissions s
    left join professionals pr on pr.id = s.profissional_id
    left join clinic_members cm on cm.clinic_id = s.clinic_id and cm.papel <> 'recepcao'
    where s.paciente_id = p_paciente
      and p_modulo = any (s.modulos)
      and s.revogado_em is null
      and (s.expira_em is null or s.expira_em > now())
      and (pr.user_id = auth.uid() or cm.user_id = auth.uid())
  );
$$;

-- Tabelas de saúde
create table medications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  principio_ativo text not null, nome_comercial text, apresentacao text, inicio_em date, status text default 'ativo',
  source origem default 'manual', created_at timestamptz default now(), updated_at timestamptz default now()
);
create table prescriptions (
  id uuid primary key default gen_random_uuid(), medication_id uuid not null references medications on delete cascade,
  dose_texto text not null, -- texto livre da receita, nunca calculado
  frequencia text, profissional_nome text, registro_conselho text
);
create table application_schedules (
  id uuid primary key default gen_random_uuid(), medication_id uuid not null references medications on delete cascade,
  dia_semana smallint check (dia_semana between 0 and 6), horario time not null
);
create table applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  medication_id uuid references medications, aplicado_em timestamptz not null,
  local text not null check (local in ('abdomen_esq','abdomen_dir','coxa_esq','coxa_dir','braco_esq','braco_dir')),
  observacao text, source origem default 'manual', created_at timestamptz default now(), updated_at timestamptz default now()
);
create table pen_inventory (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  nome text, lote text, validade date, quantidade int not null default 0
);
create table pen_purchases (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  data date not null, valor_centavos int, quantidade int, comprovante_url text
);
create table foods (
  id uuid primary key default gen_random_uuid(), nome text not null, fonte text not null check (fonte in ('TACO','TBCA','rotulo')),
  versao_tabela text not null, preparo text, proteina_100g numeric, energia_100g numeric, fibras_100g numeric
);
create table meals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  tipo text, horario timestamptz not null, foto_url text,
  source origem default 'manual', created_at timestamptz default now(), updated_at timestamptz default now()
);
create table meal_items (
  id uuid primary key default gen_random_uuid(), meal_id uuid not null references meals on delete cascade,
  food_id uuid references foods, porcao_g numeric not null, proteina_g numeric, energia_kcal numeric,
  origem origem not null, versao_tabela text
);
create table hydration_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  ml int not null, registrado_em timestamptz default now(), source origem default 'manual'
);
create table weight_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  peso_kg numeric(5,2), medida_cm numeric(5,1), tipo text default 'peso', registrado_em timestamptz default now(), source origem default 'manual'
);
create table symptoms (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  sintomas text[] not null, intensidade smallint check (intensidade between 1 and 5), observacao text,
  alerta_disparado boolean default false, registrado_em timestamptz default now(), source origem default 'manual'
);
create table workouts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  tipo text, duracao_min int, forca boolean default false, registrado_em timestamptz default now()
);
create table weekly_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  semana date not null, indicadores jsonb not null, resumo_ia text, modelo_ia text, versao_prompt text,
  unique (user_id, semana)
);

-- RLS
alter table profiles enable row level security;
alter table sharing_permissions enable row level security;
alter table consent_records enable row level security;
alter table audit_logs enable row level security;
create policy dono on profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy paciente_gerencia on sharing_permissions for all using (paciente_id = auth.uid()) with check (paciente_id = auth.uid());
create policy dono on consent_records for select using (user_id = auth.uid());
create policy consentimento_insere on consent_records for insert with check (user_id = auth.uid()); -- histórico imutável: sem update/delete
create policy paciente_ve_auditoria on audit_logs for select using (paciente_id = auth.uid());

do $$
declare t text; m text;
begin
  for t, m in select * from (values
    ('medications','aplicacoes'), ('applications','aplicacoes'), ('pen_inventory','aplicacoes'), ('pen_purchases','aplicacoes'),
    ('meals','nutricao'), ('hydration_records','nutricao'), ('weight_records','peso'),
    ('symptoms','sintomas'), ('workouts','bemestar'), ('weekly_reports','peso')
  ) as x(t, m) loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy dono_escreve on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy permitido_le on %I for select using (pode_ler(user_id, %L::modulo))', t, m);
  end loop;
end $$;

alter table meal_items enable row level security;
create policy via_refeicao on meal_items for all using (
  exists (select 1 from meals m where m.id = meal_id and pode_ler(m.user_id, 'nutricao'))
) with check (exists (select 1 from meals m where m.id = meal_id and m.user_id = auth.uid()));
alter table foods enable row level security;
create policy leitura_publica on foods for select using (true);
