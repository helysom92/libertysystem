-- Etapa 4A.2 — Fecha um segundo vazamento real, confirmado por leitura de schema: a função
-- pública `get_proposta_publica` (chamada por qualquer visitante anônimo com um link de
-- proposta — RPC já legitimamente aberta pra `anon`, controle de acesso é o token aleatório)
-- devolvia as linhas INTEIRAS de `orcamento_itens` e `itens_orcamento`:
--
--   'itens',    jsonb_agg(oi order by oi.ordem)   -- inclui custo_direto, preco_m2_manual
--   'catalogo', jsonb_agg(io)                      -- TODO o catálogo interno ativo, com preco
--
-- Isso expõe, pra qualquer pessoa com um link de proposta (que pode ser encaminhado adiante),
-- o custo direto interno de cada item em modo "fórmula" (nunca mostrado ao cliente — só o
-- valor já com markup ×3×1.15 deveria sair) e a tabela de preços inteira da empresa (todo
-- item_orcamento ativo, não só os usados nessa proposta específica).
--
-- Correção: o cálculo de preço (a mesma lógica de calcularItemOrcamento/unitParaExibicao em
-- src/lib/domain/orcamento.ts) passa a rodar DENTRO da função seguro (security definer) — só o
-- resultado já computado (área, valor unitário final, valor final já persistido) sai da
-- função. Nunca mais custo_direto, preco_m2_manual, nem o catálogo completo. O nome do item de
-- catálogo (sem preço) continua saindo, só pra montar o texto de detalhe do documento.
--
-- get_proposta_interativa não tem esse problema — devolve linhas de proposta_opcoes
-- (titulo/descricao/valor), que já são deliberadamente o preço público de cada linha
-- comercial, não custo interno. Não precisa de mudança.

create or replace function get_proposta_publica(p_token uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  cli clientes%rowtype;
  itens jsonb;
begin
  select * into sv from servicos where share_token = p_token;
  if not found then return null; end if;
  select * into cli from clientes where id = sv.cliente_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'descricao', oi.descricao,
    'categoria_prazo', oi.categoria_prazo,
    'modo_calculo', oi.modo_calculo,
    'largura_cm', oi.largura_cm,
    'altura_cm', oi.altura_cm,
    'quantidade', oi.quantidade,
    'mostrar_medida_cliente', oi.mostrar_medida_cliente,
    'item_nome', io.nome,
    'area', calc.area,
    'valor_unit', calc.valor_unit,
    'valor_final', oi.valor_final
  ) order by oi.ordem), '[]'::jsonb)
  into itens
  from orcamento_itens oi
  left join itens_orcamento io on io.id = oi.item_orcamento_id
  cross join lateral (
    select
      case
        when oi.modo_calculo = 'catalogo' and io.tipo_cobranca <> 'fixo'
          then (coalesce(oi.largura_cm, 0) / 100) * (coalesce(oi.altura_cm, 0) / 100) * oi.quantidade
        when oi.modo_calculo = 'm2_manual'
          then (coalesce(oi.largura_cm, 0) / 100) * (coalesce(oi.altura_cm, 0) / 100) * oi.quantidade
        else null
      end as area,
      case
        when oi.modo_calculo = 'formula'
          then oi.valor_final / (case when oi.quantidade = 0 then 1 else oi.quantidade end)
        when oi.modo_calculo = 'catalogo' then coalesce(io.preco, 0)
        when oi.modo_calculo = 'm2_manual' then coalesce(oi.preco_m2_manual, 0)
        else 0
      end as valor_unit
  ) calc
  where oi.servico_id = sv.id;

  return jsonb_build_object(
    'servico', jsonb_build_object(
      'numero', sv.numero, 'descricao', sv.descricao, 'valor', sv.valor,
      'linha_orcamento', sv.linha_orcamento, 'validade_proposta_dias', sv.validade_proposta_dias,
      'forma_pagamento_texto', sv.forma_pagamento_texto, 'durabilidade_texto', sv.durabilidade_texto,
      'criado_em', sv.criado_em
    ),
    'cliente', jsonb_build_object('nome', cli.nome),
    'itens', itens,
    'foto_storage_path', (select f.storage_path from fotos f where f.id = sv.capa_foto_id)
  );
end;
$$;
-- GRANT já está certo desde a migration 0046 (authenticated, anon) — função só é substituída
-- (create or replace), privilégio não muda.
