-- Segredos lidos só pelas funções de servidor (service role). Sem políticas de RLS:
-- nenhum usuário do app, logado ou não, consegue ler ou escrever.
-- O valor da ANTHROPIC_API_KEY é inserido direto no banco, nunca no repositório.
create table segredos (
  nome text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);
alter table segredos enable row level security;
revoke all on table segredos from anon, authenticated, public;
