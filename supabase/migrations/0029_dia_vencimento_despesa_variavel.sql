-- Despesa variável não tinha um dia de vencimento (só Despesa Fixa tinha) — por isso caía
-- sempre em "hoje" na lista de Contas a Pagar, em vez da data real (água/energia costumam
-- vencer perto do mesmo dia todo mês, mesmo com o valor mudando).
alter table despesas_variaveis add column if not exists dia_vencimento int check (dia_vencimento between 1 and 31);
