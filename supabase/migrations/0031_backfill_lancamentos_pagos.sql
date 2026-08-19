-- Backfill: despesas fixas/variáveis marcadas como "Pago" ANTES da correção que conecta esse
-- clique a um lançamento (migração 0024) ficaram órfãs — o checkbox salvou pago=true mas
-- nunca criou o lançamento correspondente, então elas nunca apareceram em Financeiro →
-- Lançamentos. Isso cria o lançamento que faltou pra cada ocorrência já paga sem
-- lancamento_id, e liga elas de volta.
do $$
declare
  r record;
  novo_id uuid;
  ultimo_dia int;
  dia int;
  data_lanc date;
begin
  for r in
    select o.id as ocorrencia_id, o.ano, o.mes, df.descricao, df.categoria, df.valor,
           df.fornecedor_id, df.dia_vencimento
    from despesas_fixas_ocorrencias o
    join despesas_fixas df on df.id = o.despesa_fixa_id
    where o.pago = true and o.lancamento_id is null
  loop
    ultimo_dia := extract(day from (make_date(r.ano, r.mes, 1) + interval '1 month - 1 day'))::int;
    dia := least(r.dia_vencimento, ultimo_dia);
    data_lanc := make_date(r.ano, r.mes, dia);

    insert into lancamentos (tipo, descricao, categoria, valor, data, fornecedor_id, status)
    values ('Despesa', r.descricao, r.categoria, r.valor, data_lanc, r.fornecedor_id, 'realizado')
    returning id into novo_id;

    update despesas_fixas_ocorrencias set lancamento_id = novo_id where id = r.ocorrencia_id;
  end loop;

  for r in
    select o.id as ocorrencia_id, o.ano, o.mes, o.valor_real, dv.descricao, dv.categoria,
           dv.valor_provisionado, dv.fornecedor_id, dv.data
    from despesas_variaveis_ocorrencias o
    join despesas_variaveis dv on dv.id = o.despesa_variavel_id
    where o.pago = true and o.lancamento_id is null
  loop
    data_lanc := coalesce(r.data, make_date(r.ano, r.mes, 1));

    insert into lancamentos (tipo, descricao, categoria, valor, data, fornecedor_id, status)
    values (
      'Despesa', r.descricao, r.categoria, coalesce(r.valor_real, r.valor_provisionado),
      data_lanc, r.fornecedor_id, 'realizado'
    )
    returning id into novo_id;

    update despesas_variaveis_ocorrencias set lancamento_id = novo_id where id = r.ocorrencia_id;
  end loop;
end $$;
