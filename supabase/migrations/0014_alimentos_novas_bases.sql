-- Base de alimentos: entram Ciqual 2025 (França), CNF 2026 (Canadá), AFCD R3 (Austrália), Frida 5.5 (Dinamarca) e Fineli (Finlândia).
-- Brasileiras continuam primeiro na busca (prioridade 1-3), depois USDA/CoFID (5-6) e as novas (7-8).
alter table foods drop constraint if exists foods_fonte_check;
alter table foods add constraint foods_fonte_check check (fonte in ('TACO', 'TBCA', 'POF', 'USDA', 'COFID', 'CIQUAL', 'CNF', 'AFCD', 'FRIDA', 'FINELI', 'rótulo'));
insert into food_fontes values
 ('CIQUAL', 'ANSES. Table de composition nutritionnelle des aliments Ciqual 2025. Licence Ouverte / Etalab 2.0.'),
 ('CNF', 'Health Canada. Canadian Nutrient File, 2026. Open Government Licence – Canada.'),
 ('AFCD', '© Food Standards Australia New Zealand. Australian Food Composition Database – Release 3. CC BY 4.0.'),
 ('FRIDA', '© Food Data (frida.fooddata.dk), version 5.5, November 2025. National Food Institute, Technical University of Denmark. CC BY 4.0.'),
 ('FINELI', 'Fineli. Finnish Food Composition Database. THL (Finnish Institute for Health and Welfare). CC BY 4.0.')
on conflict (fonte) do update set citacao = excluded.citacao;
-- Os dados entram com scripts/importar_alimentos.py (função temporária de importação, removida ao final).
