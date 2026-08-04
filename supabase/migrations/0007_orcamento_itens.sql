-- Sistema Liberty — Fase 3: orçamento multi-item + catálogo de preços atualizado
-- Integra a lógica do app desktop "Orçamento Liberty" (Electron) ao sistema web.

create type orcamento_categoria_prazo as enum ('balcao', 'simples', 'complexo');
create type orcamento_modo_calculo as enum ('catalogo', 'formula', 'm2_manual');

create table orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos(id) on delete cascade,
  ordem int not null default 0,
  descricao text not null default '',
  categoria_prazo orcamento_categoria_prazo not null default 'balcao',
  modo_calculo orcamento_modo_calculo not null default 'catalogo',
  item_orcamento_id uuid references itens_orcamento(id) on delete set null,
  largura_cm numeric,
  altura_cm numeric,
  quantidade int not null default 1,
  custo_direto numeric(10,2),
  preco_m2_manual numeric(10,2),
  valor_final numeric(10,2) not null default 0
);
create index orcamento_itens_servico_id_idx on orcamento_itens(servico_id);

alter table orcamento_itens enable row level security;
create policy orcamento_itens_all on orcamento_itens for all using (auth.role() = 'authenticated');

-- Tabela de preços atualizada — substitui a lista antiga por uma mais completa/precisa
-- (não apaga o histórico, só desativa o que não é mais usado).
update itens_orcamento set ativo = false;

insert into itens_orcamento (nome, tipo_cobranca, preco, categoria) values
  ('Adesivo brilho — retirada no balcão', 'm2', 90.00, 'Adesivo'),
  ('Adesivo brilho — aplicado', 'm2', 100.00, 'Adesivo'),
  ('Adesivo blackout', 'm2', 110.00, 'Adesivo'),
  ('Adesivo fosco', 'm2', 110.00, 'Adesivo'),
  ('Adesivo transparente', 'm2', 110.00, 'Adesivo'),
  ('Corte e contorno — meio corte', 'm2', 150.00, 'Adesivo'),
  ('Corte e contorno — corte inteiro manual', 'm2', 120.00, 'Adesivo'),
  ('Adesivo de recorte simples', 'm2', 100.00, 'Adesivo'),
  ('Lona front 400g comum', 'm2', 110.00, 'Lona'),
  ('PVC adesivado', 'm2', 220.00, 'PVC'),
  ('Banner 90×120cm', 'fixo', 120.00, 'Banner'),
  ('Banner pequeno 50×70cm', 'fixo', 90.00, 'Banner'),
  ('Display para Pix (padrão)', 'fixo', 90.00, 'Display'),
  ('Placa de PVC "Vende-se"/"Aluga-se" 60×40cm', 'fixo', 90.00, 'Plaquinha');
