-- Marcar uma despesa fixa/variável como paga (checkbox) até aqui só gravava
-- despesas_fixas_ocorrencias/despesas_variaveis_ocorrencias.pago = true — nunca criava um
-- lançamento em `lancamentos`, então esses pagamentos nunca apareciam no Fluxo Financeiro
-- (Lançamentos) nem entravam nos totais "Realizado". Este link permite reaproveitar o mesmo
-- padrão já usado em servico_parcelas.lancamento_id.
alter table despesas_fixas_ocorrencias add column if not exists lancamento_id uuid references lancamentos(id) on delete set null;
alter table despesas_variaveis_ocorrencias add column if not exists lancamento_id uuid references lancamentos(id) on delete set null;
