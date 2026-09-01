-- Etapa 4A.4 — Regressão real encontrada: a migration 0025_conclusao_sem_financeiro.sql já
-- tinha corrigido isso corretamente uma vez (produção conclui a OS só com confirmação de
-- entrega, o financeiro segue independente, sem travar a conclusão por saldo em aberto). A
-- migration 0034_permissoes_papeis.sql, ao reescrever a função pra adicionar a trava de "OS
-- não pode voltar pro quadro de orçamento", copiou o corpo de uma versão MAIS ANTIGA (anterior
-- à 0025) e sem querer trouxe de volta a exigência de `financeiro_status in ('Pago','Cortesia')
-- or liberado_admin` — ou seja, hoje em produção, uma OS com entrega confirmada mas saldo a
-- receber SÓ pode ser concluída se um Administrador clicar em "Liberar Admin" primeiro. Isso é
-- exatamente o problema que a 0025 já tinha resolvido, e contraria a regra confirmada: "não
-- exigir pagamento para concluir produção — a trava deve se basear em requisitos
-- operacionais, principalmente confirmação de entrega. O financeiro continua cobrando o saldo
-- pendente normalmente, nunca é apagado/quitado ao concluir."
--
-- Correção: remove de novo a exigência de financeiro_ok, mantendo a trava de board da 0034
-- (uma OS numerada não pode voltar pro quadro de Orçamentos) e o resto do comportamento igual.

create or replace function move_card_para_coluna(p_servico_id uuid, p_coluna_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  col colunas%rowtype;
begin
  select * into sv from servicos where id = p_servico_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Serviço não encontrado.');
  end if;

  select * into col from colunas where id = p_coluna_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Coluna não encontrada.');
  end if;

  if sv.numero is not null and col.board = 'orcamento' then
    return jsonb_build_object('ok', false, 'reason', 'Uma Ordem de Serviço não pode voltar para o quadro de Orçamentos.');
  end if;

  -- Só operacional: confirmação de entrega. Saldo em aberto NUNCA bloqueia conclusão — o
  -- financeiro continua sendo cobrado normalmente depois, em paralelo (Financeiro → Ordens de
  -- Serviço), sem relação com o estágio do Kanban.
  if col.is_conclusao and not sv.entrega_confirmada then
    return jsonb_build_object('ok', false, 'reason', 'Confirme a entrega antes de concluir.');
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
-- GRANT já está certo desde a migration 0046 (authenticated) — função só é substituída
-- (create or replace), privilégio não muda.
