-- Sistema Liberty — Fase 5: documento de orçamento/OS com identidade visual
-- Campos de proposta comercial (linha, forma de pagamento, durabilidade, validade),
-- token de compartilhamento público e função pública pra montar o documento sem sessão.

create type linha_orcamento as enum ('promocional', 'custo_beneficio', 'premium');

alter table servicos add column linha_orcamento linha_orcamento not null default 'custo_beneficio';
alter table servicos add column validade_proposta_dias int not null default 7;
alter table servicos add column forma_pagamento_texto text;
alter table servicos add column durabilidade_texto text;
alter table servicos add column share_token uuid unique;

-- ── Link público: gera (uma vez) o token de compartilhamento da proposta ──
create or replace function ensure_share_token(p_servico_id uuid) returns uuid
language plpgsql security definer as $$
declare
  v_token uuid;
begin
  select share_token into v_token from servicos where id = p_servico_id;
  if v_token is null then
    v_token := gen_random_uuid();
    update servicos set share_token = v_token where id = p_servico_id;
  end if;
  return v_token;
end;
$$;

-- ── Link público: devolve só o necessário pra montar o documento, sem sessão ──
-- Nunca expõe as tabelas servicos/clientes/orcamento_itens diretamente ao anon;
-- só o que essa função monta explicitamente.
create or replace function get_proposta_publica(p_token uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  cli clientes%rowtype;
begin
  select * into sv from servicos where share_token = p_token;
  if not found then
    return null;
  end if;

  select * into cli from clientes where id = sv.cliente_id;

  return jsonb_build_object(
    'servico', jsonb_build_object(
      'numero', sv.numero,
      'descricao', sv.descricao,
      'valor', sv.valor,
      'linha_orcamento', sv.linha_orcamento,
      'validade_proposta_dias', sv.validade_proposta_dias,
      'forma_pagamento_texto', sv.forma_pagamento_texto,
      'durabilidade_texto', sv.durabilidade_texto,
      'criado_em', sv.criado_em
    ),
    'cliente', jsonb_build_object('nome', cli.nome),
    'itens', coalesce(
      (select jsonb_agg(oi order by oi.ordem) from orcamento_itens oi where oi.servico_id = sv.id),
      '[]'::jsonb
    ),
    'catalogo', coalesce(
      (select jsonb_agg(io) from itens_orcamento io where io.ativo),
      '[]'::jsonb
    ),
    'foto_storage_path', (select f.storage_path from fotos f where f.id = sv.capa_foto_id)
  );
end;
$$;

grant execute on function get_proposta_publica(uuid) to anon;

-- Permite gerar a signed URL da foto-capa na página pública, só pra serviços com
-- compartilhamento ativo (share_token preenchido) — os demais objetos do bucket
-- continuam privados pela policy já existente (fotos_bucket_all).
create policy fotos_bucket_public_shared on storage.objects for select
  using (
    bucket_id = 'fotos'
    and exists (
      select 1 from servicos s
      where s.id::text = (storage.foldername(name))[1] and s.share_token is not null
    )
  );
