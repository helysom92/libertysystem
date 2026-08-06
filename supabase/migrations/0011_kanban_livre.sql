-- Sistema Liberty — Fase 8: Kanban livre (dois quadros, colunas 100% customizáveis,
-- prazo com semáforo). Aposenta o fluxo fixo por tipo (Fase 4) e o Double Check
-- dividido Admin/Produção, absorvido pelo checklist único que já existia.

create type kanban_board as enum ('orcamento', 'os');

create table colunas (
  id uuid primary key default gen_random_uuid(),
  board kanban_board not null,
  label text not null,
  ordem int not null default 0,
  is_conclusao boolean not null default false
);
create index colunas_board_idx on colunas(board, ordem);
alter table colunas enable row level security;
create policy colunas_all on colunas for all using (auth.role() = 'authenticated');

insert into colunas (board, label, ordem, is_conclusao) values
  ('orcamento', 'Digitação', 0, false),
  ('orcamento', 'Enviado ao Cliente', 1, false),
  ('os', 'OS Aberta', 0, false),
  ('os', 'Produção', 1, false),
  ('os', 'Instalação', 2, false),
  ('os', 'Concluído', 3, true);

alter table servicos add column coluna_id uuid references colunas(id) on delete set null;
alter table servicos add column concluido boolean not null default false;
alter table servicos add column prazo_tipo text;
alter table servicos add column prazo_inicio date;
alter table servicos add column informacoes_adicionais text;

-- ── Backfill: encaixa serviços existentes numa coluna a partir do estado atual ──
update servicos set coluna_id = (select id from colunas where board = 'orcamento' and ordem = 0)
  where numero is null;

update servicos set coluna_id = (select id from colunas where board = 'os' and ordem = 0)
  where numero is not null and estagio <> 'Concluído';

update servicos set
  coluna_id = (select id from colunas where board = 'os' and is_conclusao),
  concluido = true,
  concluido_em = coalesce(concluido_em, now())
  where numero is not null and estagio = 'Concluído';

-- ── Carrega o Double Check existente pro checklist único, antes de aposentar dc_* ──
insert into checklist_items (servico_id, texto, done, ordem)
select s.id, elem->>'texto', (elem->>'done')::boolean, 100 + row_number() over (partition by s.id order by ord)
from servicos s cross join lateral jsonb_array_elements(s.dc_admin) with ordinality as t(elem, ord)
where jsonb_array_length(s.dc_admin) > 0;

insert into checklist_items (servico_id, texto, done, ordem)
select s.id, elem->>'texto', (elem->>'done')::boolean, 200 + row_number() over (partition by s.id order by ord)
from servicos s cross join lateral jsonb_array_elements(s.dc_producao) with ordinality as t(elem, ord)
where jsonb_array_length(s.dc_producao) > 0;

drop trigger if exists arquivos_invalidate_dc on arquivos;
drop trigger if exists medicoes_invalidate_dc on medicoes;
drop function if exists trg_invalidate_dc_on_arquivo();
drop function if exists trg_invalidate_dc_on_medicao();
drop function if exists invalidate_dc_for_servico(uuid);
drop function if exists dc_complete(jsonb, jsonb);

alter table servicos drop column dc_admin;
alter table servicos drop column dc_producao;
alter table servicos drop column dc_invalidated_after_advance;

alter table fotos drop constraint if exists fotos_slot_check;

drop function if exists move_servico(uuid, int);
drop function if exists flow_for_tipo(servico_tipo);
drop function if exists stage_action_texto(text);
drop function if exists stage_action_responsavel(text);

-- ── seed_new_servico: 1ª coluna do quadro Orçamentos, em vez do fluxo fixo ──
create or replace function seed_new_servico() returns trigger
language plpgsql as $$
begin
  if NEW.coluna_id is null then
    select id into NEW.coluna_id from colunas where board = 'orcamento' order by ordem limit 1;
  end if;
  if NEW.estagio is null then
    select label into NEW.estagio from colunas where id = NEW.coluna_id;
  end if;
  if NEW.proxima_acao_texto is null then
    NEW.proxima_acao_texto := 'Aguardar aprovação do cliente';
    NEW.proxima_responsavel := 'Secretaria';
  end if;
  return NEW;
end;
$$;

-- ── move_card_para_coluna: motor de movimento livre, com a trava de conclusão ──
create or replace function move_card_para_coluna(p_servico_id uuid, p_coluna_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  col colunas%rowtype;
  financeiro_ok boolean;
begin
  select * into sv from servicos where id = p_servico_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Serviço não encontrado.');
  end if;

  select * into col from colunas where id = p_coluna_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Coluna não encontrada.');
  end if;

  if col.is_conclusao then
    financeiro_ok := sv.financeiro_status in ('Pago', 'Cortesia') or sv.liberado_admin;
    if not (sv.entrega_confirmada and financeiro_ok) then
      return jsonb_build_object('ok', false, 'reason', 'Confirme a entrega e o financeiro (ou libere como Administrador) antes de concluir.');
    end if;
  end if;

  update servicos set
    coluna_id = col.id,
    estagio = col.label,
    concluido = col.is_conclusao,
    concluido_em = case when col.is_conclusao then now() else null end
  where id = p_servico_id;

  insert into timeline_entries (servico_id, texto) values (p_servico_id, 'Etapa: ' || col.label);
  insert into historico_entries (servico_id, texto) values (p_servico_id, 'Movido para ' || col.label);

  return jsonb_build_object('ok', true);
end;
$$;

-- ── aprova_orcamento: numera a OS e move pra 1ª coluna do quadro OS ──
create or replace function aprova_orcamento(p_servico_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  destino colunas%rowtype;
  novo_numero text;
begin
  select * into sv from servicos where id = p_servico_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Serviço não encontrado.');
  end if;
  if sv.numero is not null then
    return jsonb_build_object('ok', false, 'reason', 'Já é uma Ordem de Serviço.');
  end if;

  select * into destino from colunas where board = 'os' order by ordem limit 1;
  novo_numero := 'OS-' || nextval('servico_numero_seq');

  update servicos set
    numero = novo_numero,
    coluna_id = destino.id,
    estagio = destino.label
  where id = p_servico_id;

  insert into checklist_items (servico_id, texto, ordem)
  select p_servico_id, texto, ordem
  from (values
    ('Conferir medidas', 0), ('Preparar arte/arquivo final', 1), ('Separar materiais', 2),
    ('Produção', 3), ('Instalação/Entrega', 4), ('Conferência final', 5)
  ) as t(texto, ordem);

  insert into historico_entries (servico_id, texto)
    values (p_servico_id, 'Orçamento aprovado — numeração ' || novo_numero || ' atribuída');

  return jsonb_build_object('ok', true, 'numero', novo_numero);
end;
$$;
