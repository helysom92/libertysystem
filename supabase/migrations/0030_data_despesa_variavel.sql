-- Ajuste pedido: pra despesa variável, em vez de um "dia de vencimento" (1-31) que se repete
-- todo mês, o usuário quer escolher a data completa (calendário) de quando pagou/lançou —
-- essas despesas são lançadas conforme são pagas, não têm um vencimento fixo de verdade.
alter table despesas_variaveis drop column if exists dia_vencimento;
alter table despesas_variaveis add column if not exists data date;
