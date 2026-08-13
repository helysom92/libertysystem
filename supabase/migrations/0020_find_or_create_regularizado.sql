-- Mesma regra aplicada em createCliente (TS): com nome + WhatsApp preenchidos, o cliente já
-- nasce Regularizado — não precisa do passo manual depois. Cobre o caminho de criar cliente
-- direto do Novo Orçamento (find_or_create_cliente), que antes sempre nascia Pré-Cadastro.
create or replace function find_or_create_cliente(p_nome text, p_whatsapp text default null)
returns uuid
language plpgsql as $$
declare
  v_id uuid;
  v_tem_whatsapp boolean := p_whatsapp is not null and p_whatsapp <> '';
begin
  select id into v_id from clientes where nome_lower = lower(p_nome);
  if found then
    if v_tem_whatsapp then
      update clientes
      set whatsapp = p_whatsapp,
          status = case when status = 'pre_cadastro' then 'regularizado' else status end
      where id = v_id and (whatsapp is null or whatsapp = '');
    end if;
    return v_id;
  end if;

  insert into clientes (nome, whatsapp, status)
  values (p_nome, nullif(p_whatsapp, ''), case when v_tem_whatsapp then 'regularizado' else 'pre_cadastro' end)
  returning id into v_id;
  return v_id;
end;
$$;
