-- Etapa E: revisão semanal das pendências (toda segunda-feira). Um registro por semana
-- (identificada pela segunda-feira) guarda quem confirmou, quando, uma observação e um
-- retrato dos números no momento da conclusão. Só Administrador enxerga e mexe.

create table if not exists revisoes_semanais (
  id uuid primary key default gen_random_uuid(),
  semana_inicio date not null unique check (extract(isodow from semana_inicio) = 1),
  revisado_em timestamptz not null default now(),
  revisado_por uuid references profiles(id),
  observacao text,
  resumo jsonb not null default '{}'::jsonb
);

alter table revisoes_semanais enable row level security;

drop policy if exists revisoes_semanais_select on revisoes_semanais;
create policy revisoes_semanais_select on revisoes_semanais
  for select using (is_admin());

drop policy if exists revisoes_semanais_insert on revisoes_semanais;
create policy revisoes_semanais_insert on revisoes_semanais
  for insert with check (is_admin());

drop policy if exists revisoes_semanais_update on revisoes_semanais;
create policy revisoes_semanais_update on revisoes_semanais
  for update using (is_admin());

drop policy if exists revisoes_semanais_delete on revisoes_semanais;
create policy revisoes_semanais_delete on revisoes_semanais
  for delete using (is_admin());
