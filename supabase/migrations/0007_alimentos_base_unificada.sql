-- Base unificada de alimentos (repositório otaviobmarques/fontes-ref): TACO, TBCA, POF/IBGE, USDA e CoFID.
-- Os dados entram com scripts/importar_alimentos.py; aqui só a estrutura e a busca.
alter table foods drop constraint if exists foods_fonte_check;
alter table foods add constraint foods_fonte_check check (fonte in ('TACO', 'TBCA', 'POF', 'USDA', 'COFID', 'rótulo'));
alter table foods add column if not exists categoria text;
alter table foods add column if not exists fibras_100g numeric;
alter table foods add column if not exists carboidrato_100g numeric;
alter table foods add column if not exists gordura_100g numeric;
alter table foods add column if not exists sodio_mg_100g numeric;
alter table foods add column if not exists medidas jsonb not null default '[]'::jsonb;
alter table foods add column if not exists nutrientes jsonb;
alter table foods add column if not exists termos text;
alter table foods add column if not exists prioridade smallint not null default 9; -- 1 TACO, 2 TBCA, 3 POF, 5 USDA, 6 CoFID
alter table foods add column if not exists codigo_original text;
alter table foods add column if not exists porcao_padrao_g numeric not null default 100;
alter table foods add column if not exists porcao_texto text;
alter table foods add column if not exists busca text; -- nome + termos, minúsculo e sem acento
alter table foods add column if not exists popular boolean not null default false;

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create index if not exists foods_busca_trgm on foods using gin (busca extensions.gin_trgm_ops);
create index if not exists foods_prioridade on foods (popular desc, prioridade);

create table if not exists food_fontes (fonte text primary key, citacao text not null);
alter table food_fontes enable row level security;
create policy leitura on food_fontes for select to anon, authenticated using (true);
insert into food_fontes values
 ('TACO', 'Tabela Brasileira de Composição de Alimentos (TACO), 4ª ed. revisada e ampliada. NEPA/UNICAMP, 2011.'),
 ('TBCA', 'Tabela Brasileira de Composição de Alimentos (TBCA). Universidade de São Paulo (USP), Food Research Center (FoRC).'),
 ('POF', 'IBGE. Pesquisa de Orçamentos Familiares 2008-2009: Tabelas de Composição Nutricional dos Alimentos Consumidos no Brasil.'),
 ('USDA', 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central (domínio público, CC0).'),
 ('COFID', 'Public Health England. McCance and Widdowson''s The Composition of Foods Integrated Dataset 2021. © Crown copyright, Open Government Licence v3.0.')
on conflict (fonte) do update set citacao = excluded.citacao;

-- Busca: sem acento, todas as palavras precisam aparecer; itens do dia a dia e fontes brasileiras primeiro
create or replace function public.buscar_alimentos(p_q text, p_limite int default 20)
returns table (id text, nome text, fonte text, categoria text, proteina_100g numeric, energia_100g numeric, fibras_100g numeric,
               carboidrato_100g numeric, gordura_100g numeric, medidas jsonb, porcao_padrao_g numeric, porcao_texto text, versao_tabela text)
language sql stable set search_path = '' as $$
  with q as (select lower(extensions.unaccent(trim(p_q))) as s),
       termos as (select array_remove(regexp_split_to_array(q.s, '\s+'), '') t, q.s from q)
  select f.id, f.nome, f.fonte, f.categoria, f.proteina_100g, f.energia_100g, f.fibras_100g, f.carboidrato_100g, f.gordura_100g,
         f.medidas, f.porcao_padrao_g, f.porcao_texto, f.versao_tabela
    from public.foods f, termos
   where length(termos.s) >= 2
     and (select bool_and(f.busca like '%' || x || '%') from unnest(termos.t) x)
   order by f.popular desc, f.prioridade, extensions.similarity(f.busca, termos.s) desc, length(f.nome)
   limit least(greatest(p_limite, 1), 50);
$$;
grant execute on function public.buscar_alimentos(text, int) to anon, authenticated;
