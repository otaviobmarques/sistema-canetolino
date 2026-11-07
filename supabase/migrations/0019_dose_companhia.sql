-- Dose como companhia ao longo do dia: lembretes por tipo, limite diário, silêncio, soneca e ritmo menor quando ignorados.
alter table reminder_log add column if not exists tipo text;
alter table reminder_log add column if not exists respondido_em timestamptz;
create index if not exists reminder_log_tipo on reminder_log (user_id, tipo, enviado_em desc);

-- estado mantido pelo servidor (o app só lê e responde a pergunta): fica fora de profiles.config
create table if not exists lembrete_estado (
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null check (tipo in ('agua', 'refeicao', 'treino')),
  ritmo text not null default 'normal' check (ritmo in ('normal', 'reduzido')),
  perguntar boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, tipo)
);
alter table lembrete_estado enable row level security;
create policy dono_le on lembrete_estado for select to authenticated using (user_id = (select auth.uid()));
create policy dono_responde on lembrete_estado for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- "Lembrar mais tarde" (botão da notificação)
create table if not exists lembrete_soneca (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null,
  enviar_em timestamptz not null,
  enviado boolean not null default false
);
create index if not exists lembrete_soneca_pendente on lembrete_soneca (enviar_em) where not enviado;
alter table lembrete_soneca enable row level security;
revoke all on lembrete_soneca from anon, authenticated;
