-- Etapa 9 — achado do review: `aprova_orcamento` nunca checava `perdido_em` (Etapa 5). Um
-- orçamento marcado como "Oportunidade perdida" (com motivo registrado) ainda podia ser
-- aprovado normalmente e virar OS numerada — o registro ficava com `numero`, `perdido_em` e
-- `motivo_perda` todos preenchidos ao mesmo tempo, contraditório, e contando como perda E
-- como venda aprovada ao mesmo tempo nos indicadores comerciais.
--
-- Corpo idêntico ao de 0052, só com mais uma checagem logo depois da de `numero`.

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
  if sv.perdido_em is not null then
    return jsonb_build_object('ok', false, 'reason', 'Essa oportunidade foi marcada como perdida — não pode ser aprovada. Se foi engano, edite o registro antes.');
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
