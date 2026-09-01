-- Etapa 6 — "Preparar (não implementar totalmente) uma classificação de unidade de negócio
-- (Comunicação Visual / Digital / Outros) sem quebrar os registros atuais." Só o campo — sem
-- filtro/relatório por unidade nesta etapa (fica pra quando o negócio realmente crescer nessa
-- direção). Nullable, sem default forçado, pra nenhuma OS existente ficar mal classificada
-- silenciosamente — "sem unidade definida" é um estado válido e visível (null), não um
-- valor forçado no meio do enum.

create type unidade_negocio as enum ('comunicacao_visual', 'digital', 'outros');

alter table servicos add column unidade_negocio unidade_negocio;
