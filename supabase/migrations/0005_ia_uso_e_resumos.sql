-- Uso da IA (cota mensal do plano Básico) e resumos semanais do Radar
create table ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null check (tipo in ('refeicao_foto', 'refeicao_texto', 'resumo_semanal')),
  modelo text,
  tokens_entrada int,
  tokens_saida int,
  em timestamptz not null default now()
);
create index on ai_usage (user_id, em desc);
alter table ai_usage enable row level security;
create policy dono_le on ai_usage for select to authenticated using (user_id = (select auth.uid()));

create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  semana date not null,
  indicadores jsonb not null,
  resumo_ia text not null,
  modelo_ia text,
  versao_prompt text not null,
  created_at timestamptz not null default now(),
  unique (user_id, semana)
);
alter table weekly_reports enable row level security;
create policy dono_le on weekly_reports for select to authenticated using (user_id = (select auth.uid()));
create policy permitido_le on weekly_reports for select to authenticated using (public.pode_ler(user_id, 'nutricao') or public.pode_ler(user_id, 'peso'));
-- gravação só pela função de servidor `ia` (service role), nunca pelo app
