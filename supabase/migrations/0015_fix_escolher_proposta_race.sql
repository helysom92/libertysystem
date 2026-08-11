-- Corrige uma condição de corrida em escolher_proposta(): o SELECT que checava "já foi
-- respondida" e o UPDATE que gravava a escolha eram passos separados, então dois cliques
-- quase simultâneos (ou duas abas abertas no mesmo link) podiam ambos passar pela checagem
-- antes de qualquer um gravar. Agora a checagem "ainda não respondida" + "linha válida" vira
-- parte da cláusula WHERE do próprio UPDATE, que é atômico — só uma chamada concorrente pode
-- de fato gravar.
create or replace function escolher_proposta(p_token uuid, p_linha linha_orcamento) returns jsonb
language plpgsql security definer as $$
declare
  v_servico_id uuid;
begin
  update servicos s set proposta_opcao_escolhida = p_linha, proposta_escolhida_em = now()
  where s.share_token = p_token
    and s.proposta_opcao_escolhida is null
    and exists (select 1 from proposta_opcoes o where o.servico_id = s.id and o.linha = p_linha)
  returning s.id into v_servico_id;

  if v_servico_id is null then
    if not exists (select 1 from servicos where share_token = p_token) then
      return jsonb_build_object('ok', false, 'reason', 'Proposta não encontrada.');
    end if;
    if exists (select 1 from servicos where share_token = p_token and proposta_opcao_escolhida is not null) then
      return jsonb_build_object('ok', false, 'reason', 'Essa proposta já foi respondida.');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'Opção inválida.');
  end if;

  insert into historico_entries (servico_id, texto)
    values (v_servico_id, 'Cliente escolheu a proposta: ' || p_linha);
  return jsonb_build_object('ok', true);
end;
$$;
