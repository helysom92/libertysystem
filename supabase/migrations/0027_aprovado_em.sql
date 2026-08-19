-- Faltava uma data de aprovação de verdade — só existia `criado_em` (quando o orçamento
-- nasceu, antes de virar OS) e `numero` (que vira não-nulo na aprovação, sem registrar
-- quando). Sem isso não dá pra somar "faturamento do mês" (valor das OS aprovadas nesse mês)
-- corretamente.
alter table servicos add column if not exists aprovado_em timestamptz;

-- Backfill pras OS já aprovadas antes dessa coluna existir: sem o timestamp real, usa
-- criado_em como aproximação (mais isso é claramente errado prum orçamento que ficou muito
-- tempo em digitação antes de aprovar — mas é a única data que existe pros registros antigos).
update servicos set aprovado_em = criado_em where numero is not null and aprovado_em is null;

create or replace function aprova_orcamento(p_servico_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  destino colunas%rowtype;
  novo_numero text;
begin
  select * into sv from servicos where id = p_servico_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Serviço não encontrado.');
  end if;
  if sv.numero is not null then
    return jsonb_build_object('ok', false, 'reason', 'Já é uma Ordem de Serviço.');
  end if;

  select * into destino from colunas where board = 'os' order by ordem limit 1;
  novo_numero := 'OS-' || nextval('servico_numero_seq');

  update servicos set
    numero = novo_numero,
    coluna_id = destino.id,
    estagio = destino.label,
    aprovado_em = now()
  where id = p_servico_id;

  insert into checklist_items (servico_id, texto, ordem)
  select p_servico_id, texto, ordem
  from (values
    ('Conferir medidas', 0), ('Preparar arte/arquivo final', 1), ('Separar materiais', 2),
    ('Produção', 3), ('Instalação/Entrega', 4), ('Conferência final', 5)
  ) as t(texto, ordem);

  insert into historico_entries (servico_id, texto)
    values (p_servico_id, 'Orçamento aprovado — numeração ' || novo_numero || ' atribuída');

  return jsonb_build_object('ok', true, 'numero', novo_numero);
end;
$$;
