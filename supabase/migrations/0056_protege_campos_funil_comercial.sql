-- Etapa 9 — achado real de um review automatizado rodado sobre a própria sessão: a Server
-- Action `updateFunilComercial` (Etapa 5, origem do lead / data de follow-up) guarda o papel
-- só do lado do Next.js (`requireRole("administrador","secretaria")`) e depois faz um
-- `update` cru na tabela `servicos` — mas a policy de UPDATE de `servicos`
-- (`servicos_update`, migration 0037) é `using (auth.role() = 'authenticated')`, sem checar
-- papel nenhum. Ou seja: um usuário de Produção autenticado, chamando a API REST direto (sem
-- passar pela tela), conseguia editar `origem_lead`/`data_follow_up` mesmo — exatamente a
-- mesma classe de furo que as migrations 0049-0051 fecharam pras RPCs.
--
-- `servicos` não pode travar UPDATE inteiro por papel (Produção legitimamente escreve
-- responsavel/prioridade/entrega_confirmada/etc — decisão já documentada desde a Etapa 1).
-- A solução já usada pros campos financeiros (`enforce_servico_permissions`, trigger que trava
-- só COLUNAS específicas) é o padrão certo aqui também — estende ela pros campos do funil
-- comercial (Etapa 5), que são tão exclusivos de admin/secretaria quanto valor/financeiro_status.

create or replace function enforce_servico_permissions() returns trigger
language plpgsql security definer as $$
begin
  if NEW.liberado_admin is distinct from OLD.liberado_admin and not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode liberar conclusão com financeiro pendente';
  end if;
  if (NEW.financeiro_status is distinct from OLD.financeiro_status
      or NEW.valor_pago is distinct from OLD.valor_pago
      or NEW.valor is distinct from OLD.valor) and not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode alterar financeiro do serviço';
  end if;
  if (NEW.origem_lead is distinct from OLD.origem_lead
      or NEW.data_follow_up is distinct from OLD.data_follow_up
      or NEW.motivo_perda is distinct from OLD.motivo_perda
      or NEW.perdido_em is distinct from OLD.perdido_em
      or NEW.proposta_enviada_em is distinct from OLD.proposta_enviada_em) and not is_admin_or_secretaria() then
    raise exception 'Apenas Administrador ou Secretaria pode alterar o funil comercial do serviço';
  end if;
  return NEW;
end;
$$;
