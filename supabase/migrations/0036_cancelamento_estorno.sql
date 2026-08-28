-- Etapa 3 — hoje não existe forma real de cancelar ou estornar um recebimento/pagamento sem
-- apagar o registro (deleteLancamento/deleteParcela são exclusão definitiva). O enum
-- lancamento_status já tem 'cancelado' desde a Fase 2 mas nenhuma action grava esse valor.
--
-- Esta migration adiciona:
--   1) um log de auditoria único (financeiro_eventos) pra qualquer pagamento/cancelamento/
--      estorno, sem precisar de uma tabela de histórico por entidade;
--   2) colunas de cancelamento em servico_parcelas e nas duas tabelas de ocorrência de despesa
--      recorrente (cancelar só um mês/uma parcela, sem desativar a regra toda nem apagar nada);
--   3) uma função atômica pra estornar o pagamento de uma parcela (reverte parcela + lançamento
--      vinculado numa transação só, mesmo padrão de segurança da 0035).
--
-- Não apaga tabela nem dado nenhum, não edita nenhuma migration anterior.

create table financeiro_eventos (
  id uuid primary key default gen_random_uuid(),
  entidade text not null check (entidade in ('lancamento', 'parcela', 'despesa_fixa_ocorrencia', 'despesa_variavel_ocorrencia')),
  entidade_id uuid not null,
  evento text not null check (evento in ('pagamento_total', 'pagamento_parcial', 'cancelamento', 'estorno')),
  valor_anterior numeric(12, 2),
  valor_novo numeric(12, 2),
  motivo text,
  usuario_id uuid references profiles(id),
  criado_em timestamptz not null default now()
);
create index financeiro_eventos_entidade_idx on financeiro_eventos(entidade, entidade_id);

alter table financeiro_eventos enable row level security;
create policy financeiro_eventos_all on financeiro_eventos for all using (is_admin_or_secretaria());

alter table servico_parcelas add column cancelada_em timestamptz;
alter table servico_parcelas add column cancelada_por uuid references profiles(id);
alter table servico_parcelas add column motivo_cancelamento text;

alter table despesas_fixas_ocorrencias add column cancelada_em timestamptz;
alter table despesas_fixas_ocorrencias add column cancelada_por uuid references profiles(id);
alter table despesas_fixas_ocorrencias add column motivo_cancelamento text;

alter table despesas_variaveis_ocorrencias add column cancelada_em timestamptz;
alter table despesas_variaveis_ocorrencias add column cancelada_por uuid references profiles(id);
alter table despesas_variaveis_ocorrencias add column motivo_cancelamento text;

create or replace function estornar_pagamento_parcela(p_parcela_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  v_parcela servico_parcelas%rowtype;
  v_valor_anterior numeric(12, 2);
begin
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

grant execute on function estornar_pagamento_parcela(uuid, text) to authenticated;
