-- Fase 10: Proposta Interativa — cliente escolhe entre 3 linhas (Promocional/Custo-Benefício/
-- Premium), cada uma com preço/descrição próprios, num link público separado do documento
-- estático já existente (/proposta/[token]). A escolha volta pro sistema.

create table proposta_opcoes (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references servicos(id) on delete cascade,
  linha linha_orcamento not null,
  titulo text not null,
  descricao text,
  valor numeric(12,2) not null default 0,
  ordem int not null default 0,
  unique (servico_id, linha)
);
create index proposta_opcoes_servico_id_idx on proposta_opcoes(servico_id);
alter table proposta_opcoes enable row level security;
create policy proposta_opcoes_all on proposta_opcoes for all using (auth.role() = 'authenticated');

alter table servicos add column proposta_opcao_escolhida linha_orcamento;
alter table servicos add column proposta_escolhida_em timestamptz;

-- Leitura pública (reaproveita o mesmo share_token/ensure_share_token da Fase 5 — um único
-- token serve pro documento estático E pra proposta interativa).
create or replace function get_proposta_interativa(p_token uuid) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
  cli clientes%rowtype;
begin
  select * into sv from servicos where share_token = p_token;
  if not found then return null; end if;
  select * into cli from clientes where id = sv.cliente_id;
  return jsonb_build_object(
    'servico', jsonb_build_object(
      'numero', sv.numero, 'descricao', sv.descricao, 'criado_em', sv.criado_em,
      'proposta_opcao_escolhida', sv.proposta_opcao_escolhida,
      'proposta_escolhida_em', sv.proposta_escolhida_em
    ),
    'cliente', jsonb_build_object('nome', cli.nome),
    'opcoes', coalesce((select jsonb_agg(o order by o.ordem) from proposta_opcoes o where o.servico_id = sv.id), '[]'::jsonb)
  );
end;
$$;
grant execute on function get_proposta_interativa(uuid) to anon;

-- Escrita pública (a escolha do cliente) — trava reenvio/duplo-clique: só aceita a primeira
-- escolha, e só entre as linhas que o Helysom de fato cadastrou.
create or replace function escolher_proposta(p_token uuid, p_linha linha_orcamento) returns jsonb
language plpgsql security definer as $$
declare
  sv servicos%rowtype;
begin
  select * into sv from servicos where share_token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'Proposta não encontrada.'); end if;
  if sv.proposta_opcao_escolhida is not null then
    return jsonb_build_object('ok', false, 'reason', 'Essa proposta já foi respondida.');
  end if;
  if not exists (select 1 from proposta_opcoes where servico_id = sv.id and linha = p_linha) then
    return jsonb_build_object('ok', false, 'reason', 'Opção inválida.');
  end if;
  update servicos set proposta_opcao_escolhida = p_linha, proposta_escolhida_em = now()
  where id = sv.id;
  insert into historico_entries (servico_id, texto)
    values (sv.id, 'Cliente escolheu a proposta: ' || p_linha);
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function escolher_proposta(uuid, linha_orcamento) to anon;
