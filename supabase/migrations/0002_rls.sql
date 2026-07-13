-- Sistema Liberty — Row Level Security
-- See C:\Users\DellUser\.claude\plans\replicated-scribbling-flame.md §3 for rationale.

-- ── role helpers ──────────────────────────────────────────────────────
create or replace function auth_role() returns role_enum
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable as $$ select auth_role() = 'administrador' $$;

create or replace function is_admin_or_producao() returns boolean
language sql stable as $$ select auth_role() in ('administrador','producao') $$;

create or replace function is_admin_or_secretaria() returns boolean
language sql stable as $$ select auth_role() in ('administrador','secretaria') $$;

-- ── enable RLS everywhere ─────────────────────────────────────────────
alter table profiles enable row level security;
alter table clientes enable row level security;
alter table servicos enable row level security;
alter table medicoes enable row level security;
alter table arquivos enable row level security;
alter table fotos enable row level security;
alter table checklist_items enable row level security;
alter table timeline_entries enable row level security;
alter table historico_entries enable row level security;
alter table eventos enable row level security;
alter table lancamentos enable row level security;
alter table despesas_fixas enable row level security;
alter table despesas_fixas_ocorrencias enable row level security;
alter table comprovantes enable row level security;

-- ── profiles: everyone can read all profiles (needed for "responsável" pickers); only self can update own row ──
create policy profiles_select on profiles for select using (auth.role() = 'authenticated');
create policy profiles_update_self on profiles for update using (id = auth.uid());

-- ── non-financeiro tables: all 3 authenticated roles (matches prototype's permissive default) ──
create policy clientes_all on clientes for all using (auth.role() = 'authenticated');
create policy servicos_all on servicos for all using (auth.role() = 'authenticated');
create policy medicoes_all on medicoes for all using (auth.role() = 'authenticated');
create policy arquivos_all on arquivos for all using (auth.role() = 'authenticated');
create policy fotos_all on fotos for all using (auth.role() = 'authenticated');
create policy checklist_items_all on checklist_items for all using (auth.role() = 'authenticated');
create policy timeline_entries_all on timeline_entries for all using (auth.role() = 'authenticated');
create policy historico_entries_all on historico_entries for all using (auth.role() = 'authenticated');
create policy eventos_all on eventos for all using (auth.role() = 'authenticated');

-- ── financeiro tables: administrador + secretaria only (decision #1) ──
create policy lancamentos_all on lancamentos for all using (is_admin_or_secretaria());
create policy despesas_fixas_all on despesas_fixas for all using (is_admin_or_secretaria());
create policy despesas_fixas_ocorrencias_all on despesas_fixas_ocorrencias for all using (is_admin_or_secretaria());
create policy comprovantes_all on comprovantes for all using (is_admin_or_secretaria());

-- ── column-level guards on servicos (RLS can't do column-level checks) ──
create or replace function enforce_servico_permissions() returns trigger
language plpgsql security definer as $$
begin
  if NEW.dc_admin is distinct from OLD.dc_admin and not is_admin() then
    raise exception 'Apenas Administrador pode alterar Double Check do Administrador';
  end if;
  if NEW.dc_producao is distinct from OLD.dc_producao and not is_admin_or_producao() then
    raise exception 'Apenas Administrador ou Produção pode alterar Double Check da Produção';
  end if;
  if NEW.liberado_admin is distinct from OLD.liberado_admin and not is_admin() then
    raise exception 'Apenas Administrador pode liberar conclusão com financeiro pendente';
  end if;
  if (NEW.financeiro_status is distinct from OLD.financeiro_status
      or NEW.valor_pago is distinct from OLD.valor_pago) and not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode alterar financeiro do serviço';
  end if;
  return NEW;
end;
$$;
create trigger servicos_permission_guard before update on servicos
  for each row execute function enforce_servico_permissions();

-- ── storage buckets: private, signed-URL only ──────────────────────────
insert into storage.buckets (id, name, public) values ('arquivos', 'arquivos', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false)
  on conflict (id) do nothing;

create policy arquivos_bucket_all on storage.objects for all
  using (bucket_id = 'arquivos' and auth.role() = 'authenticated')
  with check (bucket_id = 'arquivos' and auth.role() = 'authenticated');

create policy fotos_bucket_all on storage.objects for all
  using (bucket_id = 'fotos' and auth.role() = 'authenticated')
  with check (bucket_id = 'fotos' and auth.role() = 'authenticated');
