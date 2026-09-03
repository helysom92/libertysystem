-- Etapa 9 — "toda ação sensível deve gerar histórico apropriado (... mudança de papel de
-- usuário ...) registrando usuário, data/hora, entidade, ação". Troca de papel já era
-- bloqueada pra quem não é Administrador (`enforce_profile_role_change`, migration 0034), mas
-- não ficava registrada em lugar nenhum quando um Administrador de fato trocava o papel de
-- alguém — a Server Action (`updateUserRole`) fazia só um `update` puro, sem auditoria.
--
-- Reaproveita `financeiro_eventos` (já é o log genérico append-only do sistema — parcela,
-- despesa, serviço) em vez de criar uma tabela nova só pra isso. Loga DENTRO do trigger (não
-- na Server Action) — assim vale pra qualquer caminho que troque o papel, não só o botão da
-- tela de Usuários.

alter table financeiro_eventos drop constraint financeiro_eventos_entidade_check;
alter table financeiro_eventos add constraint financeiro_eventos_entidade_check
  check (entidade in ('lancamento', 'parcela', 'despesa_fixa_ocorrencia', 'despesa_variavel_ocorrencia', 'servico', 'parcela_recebimento', 'profile_role'));

alter table financeiro_eventos drop constraint financeiro_eventos_evento_check;
alter table financeiro_eventos add constraint financeiro_eventos_evento_check
  check (evento in ('pagamento_total', 'pagamento_parcial', 'cancelamento', 'estorno', 'alteracao'));

create or replace function enforce_profile_role_change() returns trigger
language plpgsql as $$
begin
  if NEW.role is distinct from OLD.role then
    if not is_admin() then
      raise exception 'Apenas Administrador pode alterar a função de um usuário';
    end if;
    insert into financeiro_eventos (entidade, entidade_id, evento, motivo, usuario_id)
    values ('profile_role', NEW.id, 'alteracao', OLD.role || ' -> ' || NEW.role, auth.uid());
  end if;
  return NEW;
end;
$$;
