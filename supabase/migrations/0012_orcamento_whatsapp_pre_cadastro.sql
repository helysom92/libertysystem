-- Novo orçamento passa a capturar o WhatsApp do cliente na criação, e clientes novos criados
-- por esse fluxo nascem como pré-cadastro (não "regularizado") — só a tela de Clientes decide
-- quando um cliente vira regularizado de fato.
create or replace function find_or_create_cliente(p_nome text, p_whatsapp text default null)
returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  select id into v_id from clientes where nome_lower = lower(p_nome);
  if found then
    if p_whatsapp is not null and p_whatsapp <> '' then
      update clientes set whatsapp = p_whatsapp
      where id = v_id and (whatsapp is null or whatsapp = '');
    end if;
    return v_id;
  end if;

  insert into clientes (nome, whatsapp, status)
  values (p_nome, nullif(p_whatsapp, ''), 'pre_cadastro')
  returning id into v_id;
  return v_id;
end;
$$;
