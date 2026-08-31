-- Finanças Pessoais — corrige bug real achado em teste manual (2026-08-31): o trigger de
-- bloqueio de exclusão (migration 0039) escrevia a condição como
-- `if TG_TABLE_NAME = 'receitas_pessoais' and OLD.valor_recebido > 0 then`, combinando os dois
-- lados num único `and`. Como o mesmo trigger serve pras duas tabelas (que têm colunas
-- diferentes — receitas_pessoais não tem `valor_pago`, despesas_pessoais não tem
-- `valor_recebido`), o Postgres tenta resolver `OLD.valor_pago` mesmo ao excluir uma
-- `receitas_pessoais` e falha com "record 'old' has no field 'valor_pago'" — antes de sequer
-- chegar a checar se há histórico de verdade. A migration 0037 (empresarial) já resolve isso
-- corretamente usando `if TG_TABLE_NAME = 'x' then` como bloco externo, e um `if OLD.campo`
-- separado DENTRO dele — replica exatamente esse padrão aqui.

create or replace function bloquear_exclusao_pessoal_com_historico() returns trigger
language plpgsql as $$
begin
  if TG_TABLE_NAME = 'receitas_pessoais' then
    if OLD.valor_recebido > 0 then
      raise exception 'Esta receita já tem recebimento registrado e não pode ser excluída. Cancele em vez de excluir.';
    end if;
  elsif TG_TABLE_NAME = 'despesas_pessoais' then
    if OLD.valor_pago > 0 then
      raise exception 'Esta despesa já tem pagamento registrado e não pode ser excluída. Cancele em vez de excluir.';
    end if;
  end if;
  return OLD;
end;
$$;
