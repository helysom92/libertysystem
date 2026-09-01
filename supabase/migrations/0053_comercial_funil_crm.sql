-- Etapa 5 — Comercial e CRM macro. NÃO é rentabilidade por OS (fora de escopo, backlog
-- futuro) — é só dar estrutura ao funil comercial que já existe de fato (Kanban de
-- Orçamentos, já livre/customizável) com os campos que faltam pra virar indicador: de onde
-- veio o lead, quando é o próximo follow-up, quando a proposta foi enviada, e por que uma
-- oportunidade foi perdida (hoje só existe `financeiro_status='Cancelado'`, que é um conceito
-- financeiro de OS já aprovada — não serve pra marcar um ORÇAMENTO que nunca virou OS como
-- "perdido", com motivo).

alter table servicos add column origem_lead text;
alter table servicos add column data_follow_up date;
alter table servicos add column proposta_enviada_em timestamptz;
alter table servicos add column motivo_perda text;
alter table servicos add column perdido_em timestamptz;

-- `ensure_share_token` passa a marcar `proposta_enviada_em` na primeira vez que o link é
-- gerado — coincide exatamente com o momento real de "enviar" no fluxo atual (o botão gera o
-- token e abre o WhatsApp na sequência). Resto do corpo idêntico ao que já existe (0009/0050),
-- só ganhou a checagem de papel (0050) e agora esse registro de data.
create or replace function ensure_share_token(p_servico_id uuid) returns uuid
language plpgsql security definer as $$
declare
  v_token uuid;
begin
  if not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode gerar o link de proposta.';
  end if;
  select share_token into v_token from servicos where id = p_servico_id;
  if v_token is null then
    v_token := gen_random_uuid();
    update servicos set share_token = v_token, proposta_enviada_em = coalesce(proposta_enviada_em, now())
    where id = p_servico_id;
  end if;
  return v_token;
end;
$$;

-- Marca uma oportunidade como perdida — só faz sentido pra orçamento ainda não aprovado
-- (numero is null); pra OS já aprovada que não vai mais receber pagamento, o conceito certo
-- continua sendo `cancelar_servico` (financeiro_status='Cancelado'), sem mudança. Não apaga
-- nada, só marca — mesma filosofia de cancelar_servico.
create or replace function perder_orcamento(p_servico_id uuid, p_motivo text) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode marcar uma oportunidade como perdida.');
  end if;
  select * into sv from servicos where id = p_servico_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Serviço não encontrado.');
  end if;
  if sv.numero is not null then
    return jsonb_build_object('ok', false, 'reason', 'Já é uma Ordem de Serviço aprovada — use Cancelar Serviço em vez de Perder Oportunidade.');
  end if;
  if p_motivo is null or trim(p_motivo) = '' then
    return jsonb_build_object('ok', false, 'reason', 'Informe o motivo da perda.');
  end if;

  update servicos set motivo_perda = p_motivo, perdido_em = now() where id = p_servico_id;
  insert into historico_entries (servico_id, texto)
    values (p_servico_id, 'Oportunidade perdida — ' || p_motivo);

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function perder_orcamento(uuid, text) to authenticated;
