-- Medidas corporais (módulo peso e medidas)
create table measurements (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null check (tipo in ('cintura', 'quadril', 'abdomen', 'braco', 'coxa', 'peito', 'pescoco')),
  medida_cm numeric(5,1) not null check (medida_cm between 10 and 300),
  registrado_em timestamptz not null default now()
);
create index on measurements (user_id, registrado_em desc);
alter table measurements enable row level security;
create policy dono_escreve on measurements for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy permitido_le on measurements for select to authenticated using (public.pode_ler(user_id, 'peso'));

-- Fotos de evolução: só o próprio paciente (não entram no compartilhamento com profissionais)
create table progress_photos (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  caminho text not null,
  angulo text check (angulo in ('frente', 'lado', 'costas')),
  registrado_em timestamptz not null default now()
);
alter table progress_photos enable row level security;
create policy dono on progress_photos for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evolucao', 'evolucao', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy evolucao_dono_le on storage.objects for select to authenticated using (bucket_id = 'evolucao' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy evolucao_dono_envia on storage.objects for insert to authenticated with check (bucket_id = 'evolucao' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy evolucao_dono_apaga on storage.objects for delete to authenticated using (bucket_id = 'evolucao' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Alimentos do rótulo (produtos de marca cadastrados pela pessoa)
create table user_foods (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  nome text not null,
  porcao_g numeric not null check (porcao_g > 0),
  porcao_texto text,
  proteina_g numeric not null check (proteina_g >= 0),
  energia_kcal numeric,
  created_at timestamptz not null default now()
);
alter table user_foods enable row level security;
create policy dono on user_foods for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
