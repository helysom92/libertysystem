-- Finanças Pessoais — Bloco E: bucket de storage dedicado pra importação de extratos.
--
-- O bucket `arquivos` (empresarial) já é liberado pra qualquer usuário autenticado — não dá
-- pra reaproveitar pra dado pessoal do Helysom sem vazar (RLS de storage.objects é permissiva
-- por bucket, uma policy adicional mais restrita não "aperta" uma policy já mais aberta no
-- mesmo bucket). Por isso um bucket novo, privado, com a mesma regra de identidade
-- (`is_helysom()`) usada em toda tabela deste módulo — nunca por papel/role.
--
-- O extrato enviado é lido pela IA e IMEDIATAMENTE apagado do storage depois de extraído
-- (`analisarExtratoPessoal`, na Server Action) — não precisa reter o PDF do banco.

insert into storage.buckets (id, name, public)
values ('financas-pessoais', 'financas-pessoais', false)
on conflict (id) do nothing;

create policy financas_pessoais_storage_all on storage.objects for all
  using (bucket_id = 'financas-pessoais' and is_helysom())
  with check (bucket_id = 'financas-pessoais' and is_helysom());
