-- Etapa 4B — Checklist como mecanismo principal de verificação, com listas diferentes por
-- complexidade do serviço (regra explícita do plano: não forçar checklist complexo num
-- serviço simples). Hoje `aprova_orcamento` semeia sempre os mesmos 6 itens genéricos,
-- independente do serviço ser um balcão de 48h ou uma instalação complexa de 15 dias.
--
-- Complexidade é derivada do maior `categoria_prazo` entre os itens do orçamento (mesmo sinal
-- que já define o prazo estimado do documento, via CATEGORIA_PRAZO_INFO em
-- src/lib/domain/orcamento.ts — balcao < simples < complexo). Sem orcamento_itens (serviço
-- legado pré multi-item), cai no template intermediário.
--
-- Não recria o Double Check como campo separado — os itens de "medida inicial"/"double check"/
-- "arte aprovada" etc. do template complexo são só entradas de checklist_items normais, mesmo
-- mecanismo livre que já existe (o plano pede exatamente isso, não uma estrutura nova).

create or replace function aprova_orcamento(p_servico_id uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  destino colunas%rowtype;
  novo_numero text;
  v_complexidade orcamento_categoria_prazo;
begin
  if not is_admin_or_secretaria() then
    return jsonb_build_object('ok', false, 'reason', 'Apenas Administrador ou Secretaria pode aprovar um orçamento.');
  end if;

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

  select oi.categoria_prazo into v_complexidade
  from orcamento_itens oi
  where oi.servico_id = p_servico_id
  order by case oi.categoria_prazo
    when 'complexo' then 3
    when 'simples' then 2
    when 'balcao' then 1
  end desc
  limit 1;

  if v_complexidade = 'balcao' then
    insert into checklist_items (servico_id, texto, ordem)
    select p_servico_id, texto, ordem
    from (values
      ('Produção', 0), ('Conferência final', 1), ('Entrega confirmada', 2)
    ) as t(texto, ordem);
  elsif v_complexidade = 'complexo' then
    insert into checklist_items (servico_id, texto, ordem)
    select p_servico_id, texto, ordem
    from (values
      ('Medida inicial', 0), ('Double check de medidas', 1), ('Arte aprovada', 2),
      ('Arquivo final', 3), ('Material conferido', 4), ('Produção', 5),
      ('Instalação', 6), ('Fotos finais', 7), ('Entrega confirmada', 8)
    ) as t(texto, ordem);
  else
    -- 'simples' ou serviço sem orcamento_itens (legado) — template intermediário, igual ao
    -- padrão genérico que já existia antes desta migration.
    insert into checklist_items (servico_id, texto, ordem)
    select p_servico_id, texto, ordem
    from (values
      ('Conferir medidas', 0), ('Preparar arte/arquivo final', 1), ('Separar materiais', 2),
      ('Produção', 3), ('Instalação/Entrega', 4), ('Conferência final', 5)
    ) as t(texto, ordem);
  end if;

  insert into historico_entries (servico_id, texto)
    values (p_servico_id, 'Orçamento aprovado — numeração ' || novo_numero || ' atribuída');

  return jsonb_build_object('ok', true, 'numero', novo_numero);
end;
$$;
