-- Sistema Liberty — catálogo de itens de orçamento (tabela de preços real da Liberty)
-- See C:\Users\DellUser\.claude\plans\replicated-scribbling-flame.md (extensão pós-plano,
-- baseada na planilha "banco_precificacao_liberty_atualizado.xlsx" compartilhada pelo usuário).

create type item_orcamento_cobranca as enum ('m2', 'fixo');

create table itens_orcamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo_cobranca item_orcamento_cobranca not null,
  preco numeric(10,2),           -- null = "sob projeto" (sem preço fixo, sempre via fórmula personalizada)
  categoria text,
  ativo boolean not null default true
);

alter table itens_orcamento enable row level security;
create policy itens_orcamento_all on itens_orcamento for all using (is_admin_or_secretaria());

-- Preços reais fornecidos pelo usuário (não é dado fictício de teste)
insert into itens_orcamento (nome, tipo_cobranca, preco, categoria) values
  ('Painel em lona', 'm2', 100.00, 'Lona'),
  ('Adesivo comum', 'm2', 100.00, 'Adesivo'),
  ('Banner padrão (90 × 120 cm)', 'fixo', 120.00, 'Banner'),
  ('Plaquinha "Vende-se"', 'fixo', 80.00, 'Plaquinha'),
  ('Display de Pix em ACM', 'fixo', 80.00, 'Display'),
  ('Lona com ilhós', 'm2', 115.00, 'Lona'),
  ('Quadro de lona com estrutura metálica', 'm2', 220.00, 'Lona'),
  ('Adesivo perfurado', 'm2', 150.00, 'Adesivo'),
  ('Adesivo de recorte', 'm2', 120.00, 'Adesivo'),
  ('Adesivo com corte e contorno', 'm2', 150.00, 'Adesivo'),
  ('Letras, ACM, Acrílico e projetos especiais', 'm2', null, 'Sob Projeto');
