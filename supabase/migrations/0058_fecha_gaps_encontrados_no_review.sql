-- Etapa 9 — mais 2 achados de um review automatizado sobre a sessão inteira:
--
-- 1) `estornar_pagamento_parcela` (migration 0036) é uma RPC antiga, já substituída por
--    `estornar_recebimento_parcela` (0037, com ledger granular) — a migration 0050 blindou
--    TODAS as RPCs financeiras com checagem de papel interna, mas essa aqui especificamente
--    ficou de fora por engano (só recebeu o GRANT defensivo em 0046, sem a checagem). Corrige
--    agora — corpo idêntico ao de 0036, só com a checagem no início.
--
-- 2) `.slice(0,10)` num timestamptz (`proposta_enviada_em`) em vez de usar o fuso da operação
--    — o mesmo bug de fuso que `dates.ts` já documenta duas vezes e evita em todo o resto do
--    sistema. Uma proposta enviada às 21h-23h59 (horário de MS) grava como já sendo o dia
--    seguinte em UTC, empurrando a data de vencimento da proposta um dia a mais do que devia.

create or replace function estornar_pagamento_parcela(p_parcela_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_parcela servico_parcelas%rowtype;
  v_valor_anterior numeric(12, 2);
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode estornar pagamento.');
  end if;

  select * into v_parcela from servico_parcelas where id = p_parcela_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Parcela não encontrada.');
  end if;
  if v_parcela.valor_pago is null then
    return jsonb_build_object('ok', false, 'reason', 'Essa parcela não tem pagamento pra estornar.');
  end if;
  v_valor_anterior := v_parcela.valor_pago;

  if v_parcela.lancamento_id is not null then
    update lancamentos set status = 'previsto' where id = v_parcela.lancamento_id;
  end if;

  update servico_parcelas
  set valor_pago = null, pago_em = null, forma_pagamento = null
  where id = p_parcela_id;

  insert into financeiro_eventos (entidade, entidade_id, evento, valor_anterior, valor_novo, motivo, usuario_id)
  values ('parcela', p_parcela_id, 'estorno', v_valor_anterior, null, p_motivo, auth.uid());

  return jsonb_build_object('ok', true);
end;
$$;
