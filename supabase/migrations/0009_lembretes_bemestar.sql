-- Bem-estar e sono (módulo 'bemestar')
create table wellbeing_records (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  sono_horas numeric(3,1) check (sono_horas between 0 and 24),
  sono_qualidade smallint check (sono_qualidade between 1 and 5),
  humor smallint check (humor between 1 and 5),
  energia smallint check (energia between 1 and 5),
  fome smallint check (fome between 1 and 5),
  observacao text,
  registrado_em timestamptz not null default now()
);
create index on wellbeing_records (user_id, registrado_em desc);
alter table wellbeing_records enable row level security;
create policy dono_escreve on wellbeing_records for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy permitido_le on wellbeing_records for select to authenticated using (public.pode_ler(user_id, 'bemestar'));

-- Lembretes por notificação (Web Push)
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  aparelho text,
  created_at timestamptz not null default now(),
  ultimo_erro text
);
create index on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;
create policy dono on push_subscriptions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table reminder_log (
  user_id uuid not null references auth.users on delete cascade,
  chave text not null, -- ex.: aplicacao:2026-11-08, agua:2026-11-08:14, validade:2027-03
  enviado_em timestamptz not null default now(),
  primary key (user_id, chave)
);
alter table reminder_log enable row level security;

alter table profiles add column if not exists fuso text not null default 'America/Sao_Paulo';

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Segredos (valores inseridos direto no banco, nunca no repositório):
--   insert into segredos (nome, valor) values ('VAPID_PRIVATE_KEY', '...'), ('VAPID_PUBLIC_KEY', '...'), ('LEMBRETES_TOKEN', '...');

select cron.schedule('canetolino-lembretes', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://mmxoenkeuyvjvahkofik.supabase.co/functions/v1/lembretes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-lembretes-token', (select valor from public.segredos where nome = 'LEMBRETES_TOKEN')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
select cron.schedule('canetolino-limpa-lembretes', '0 7 * * *', $$ delete from public.reminder_log where enviado_em < now() - interval '60 days' $$);
