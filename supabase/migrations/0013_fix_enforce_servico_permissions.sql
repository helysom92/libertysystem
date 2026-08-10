-- BUG: a migração 0011 (kanban livre) apagou as colunas dc_admin/dc_producao de servicos
-- (retirando o Double Check antigo), mas esqueceu de atualizar o gatilho
-- enforce_servico_permissions (criado em 0002_rls.sql), que ainda referenciava
-- NEW.dc_admin/NEW.dc_producao. Resultado: TODO update em servicos (mover card no Kanban,
-- definir capa, aprovar orçamento, trocar responsável, prioridade, prazo etc.) vinha
-- quebrando com "record new has no field dc_admin" (Postgres 42703) desde então.

create or replace function enforce_servico_permissions() returns trigger
language plpgsql security definer as $$
begin
  if NEW.liberado_admin is distinct from OLD.liberado_admin and not is_admin() then
    raise exception 'Apenas Administrador pode liberar conclusão com financeiro pendente';
  end if;
  if (NEW.financeiro_status is distinct from OLD.financeiro_status
      or NEW.valor_pago is distinct from OLD.valor_pago) and not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode alterar financeiro do serviço';
  end if;
  return NEW;
end;
$$;
