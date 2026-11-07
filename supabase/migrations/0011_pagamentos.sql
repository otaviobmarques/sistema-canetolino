-- Canetolino · assinaturas pagas (Asaas, Mercado Pago ou Stripe), escolhidas no painel Admin.
-- As chaves de cada gateway ficam na tabela `segredos` (nunca no repositório) e só o administrador grava.
-- O plano do paciente (profiles.plano) só muda pelo servidor, quando o gateway confirma o pagamento.

/* ---------- o paciente não pode trocar o próprio plano pela API ---------- */
create or replace function public.proteger_plano() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.plano := 'basico'; else new.plano := old.plano; end if;
  end if;
  return new;
end $$;
create trigger proteger_plano before insert or update on public.profiles for each row execute function public.proteger_plano();

/* ---------- configuração: um único registro ---------- */
create table config_pagamentos (
  id boolean primary key default true check (id),
  gateway text not null default 'asaas' check (gateway in ('asaas', 'mercadopago', 'stripe')),
  modo text not null default 'teste' check (modo in ('teste', 'producao')),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null
);
insert into config_pagamentos default values;
alter table config_pagamentos enable row level security;
revoke all on table config_pagamentos from anon, authenticated, public;

/* ---------- assinaturas ---------- */
create table assinaturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  gateway text not null check (gateway in ('asaas', 'mercadopago', 'stripe')),
  modo text not null check (modo in ('teste', 'producao')),
  plano text not null check (plano in ('basico', 'premium')),
  periodo text not null check (periodo in ('mensal', 'anual')),
  valor numeric(10,2) not null,
  status text not null default 'pendente' check (status in ('pendente', 'ativa', 'atrasada', 'cancelada')),
  cliente_externo text,
  assinatura_externa text,
  proximo_vencimento timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (gateway, assinatura_externa)
);
create index on assinaturas (user_id);
alter table assinaturas enable row level security;
create policy dono_le on assinaturas for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on table assinaturas from anon, authenticated, public;

/* ---------- eventos recebidos dos gateways (sem dados pessoais) ---------- */
create table pagamentos_eventos (
  id bigint generated always as identity primary key,
  gateway text not null,
  modo text,
  evento_id text not null,
  tipo text not null,
  assinatura_id uuid references assinaturas on delete set null,
  resultado text,
  recebido_em timestamptz not null default now(),
  unique (gateway, evento_id)
);
alter table pagamentos_eventos enable row level security;
revoke all on table pagamentos_eventos from anon, authenticated, public;

/* ---------- plano do paciente a partir das assinaturas ---------- */
create or replace function public.atualizar_plano(p_user uuid) returns void language sql security definer set search_path = '' as $$
  update public.profiles set plano = case when exists (
      select 1 from public.assinaturas where user_id = p_user and plano = 'premium' and status in ('ativa', 'atrasada')
    ) then 'premium' else 'basico' end
   where user_id = p_user;
$$;
revoke execute on function public.atualizar_plano from anon, authenticated, public;

/* ---------- painel Admin ---------- */
create or replace function public.campos_gateway(p_gateway text) returns text[] language sql immutable set search_path = '' as $$
  select case p_gateway
    when 'asaas' then array['api_key', 'webhook_token']
    when 'mercadopago' then array['access_token', 'webhook_secret']
    when 'stripe' then array['secret_key', 'webhook_secret']
  end;
$$;

create or replace function public.admin_pagamentos() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare cfg public.config_pagamentos; cred jsonb := '{}'::jsonb; g text; m text; f text; v text;
begin
  if not public.eh_admin() then raise exception 'sem acesso'; end if;
  select * into cfg from public.config_pagamentos;
  foreach g in array array['asaas', 'mercadopago', 'stripe'] loop
    foreach m in array array['teste', 'producao'] loop
      foreach f in array public.campos_gateway(g) loop
        select valor into v from public.segredos where nome = upper(g || '_' || m || '_' || f);
        -- devolve só o final da chave, nunca o valor inteiro
        cred := jsonb_set(cred, array[g], coalesce(cred -> g, '{}'::jsonb), true);
        cred := jsonb_set(cred, array[g, m], coalesce(cred -> g -> m, '{}'::jsonb), true);
        cred := jsonb_set(cred, array[g, m, f], case when v is null then 'null'::jsonb else to_jsonb('••••' || right(v, 4)) end, true);
        v := null;
      end loop;
    end loop;
  end loop;
  return jsonb_build_object(
    'gateway', cfg.gateway, 'modo', cfg.modo, 'atualizado_em', cfg.atualizado_em,
    'credenciais', cred,
    'assinaturas', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (
        select status, count(*) n from public.assinaturas where modo = cfg.modo group by status) x),
    'receita_mensal', (select coalesce(sum(case when periodo = 'anual' then valor / 12 else valor end), 0)
        from public.assinaturas where modo = cfg.modo and status in ('ativa', 'atrasada')),
    'eventos', (select coalesce(jsonb_agg(e order by e.recebido_em desc), '[]'::jsonb) from (
        select gateway, modo, tipo, resultado, recebido_em from public.pagamentos_eventos order by recebido_em desc limit 15) e)
  );
end $$;

create or replace function public.admin_config_pagamentos(p_gateway text, p_modo text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'sem acesso'; end if;
  update public.config_pagamentos set gateway = p_gateway, modo = p_modo, atualizado_em = now(), atualizado_por = auth.uid() where id;
end $$;

create or replace function public.admin_salvar_credencial(p_gateway text, p_modo text, p_campo text, p_valor text) returns void language plpgsql security definer set search_path = '' as $$
declare v_nome text := upper(p_gateway || '_' || p_modo || '_' || p_campo);
begin
  if not public.eh_admin() then raise exception 'sem acesso'; end if;
  if p_modo not in ('teste', 'producao') or not (p_campo = any(coalesce(public.campos_gateway(p_gateway), '{}'))) then raise exception 'campo inválido'; end if;
  if coalesce(trim(p_valor), '') = '' then
    delete from public.segredos where nome = v_nome;
  else
    insert into public.segredos (nome, valor) values (v_nome, trim(p_valor))
      on conflict (nome) do update set valor = excluded.valor, atualizado_em = now();
  end if;
end $$;

revoke execute on function public.admin_pagamentos, public.admin_config_pagamentos, public.admin_salvar_credencial, public.campos_gateway from anon, public;
grant execute on function public.admin_pagamentos, public.admin_config_pagamentos, public.admin_salvar_credencial to authenticated;
