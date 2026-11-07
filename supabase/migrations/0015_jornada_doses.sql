-- Jornada: quem está começando e quem já está em tratamento; dose em cada aplicação; registros retroativos.
alter table profiles add column if not exists jornada text check (jornada in ('comecando', 'em_tratamento'));
alter table profiles add column if not exists inicio_tratamento date;

alter table applications add column if not exists dose_texto text check (char_length(dose_texto) <= 40);
-- registrado depois do dia (doses passadas, vindas do caderno ou do bloco de notas); aparece assim para o profissional
alter table applications add column if not exists retroativo boolean not null default false;
alter table weight_records add column if not exists retroativo boolean not null default false;
-- doses passadas: muita gente não anotou o local; ele passa a ser opcional
alter table applications alter column local drop not null;
