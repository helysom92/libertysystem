-- Secretaria deve ter as mesmas permissões de edição que o Administrador (só a aba Gestão
-- continua exclusiva do Administrador, controlada só no front-end). Hoje só is_admin() podia
-- mudar liberado_admin — abre também pra is_admin_or_secretaria().
create or replace function enforce_servico_permissions() returns trigger
language plpgsql security definer as $$
begin
  if NEW.liberado_admin is distinct from OLD.liberado_admin and not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode liberar conclusão com financeiro pendente';
  end if;
  if (NEW.financeiro_status is distinct from OLD.financeiro_status
      or NEW.valor_pago is distinct from OLD.valor_pago) and not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode alterar financeiro do serviço';
  end if;
  return NEW;
end;
$$;
