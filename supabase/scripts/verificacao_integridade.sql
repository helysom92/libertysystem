-- Etapa 9 — verificação de integridade. 100% SELECT, nenhuma escrita, seguro rodar a qualquer
-- momento (inclusive em produção) quantas vezes quiser. Cada bloco devolve 0 linhas quando
-- está tudo certo — qualquer linha devolvida é algo que vale a pena olhar com calma antes de
-- decidir o que fazer (esse script nunca corrige nada sozinho, só aponta).
--
-- Rode cada bloco separadamente no SQL Editor (ou o arquivo inteiro de uma vez — são só
-- SELECTs independentes).

-- ── 1) OS/orçamento com cliente que não existe mais ────────────────────────────────────────
select s.id, s.numero, s.cliente, s.cliente_id
from servicos s
left join clientes c on c.id = s.cliente_id
where c.id is null;

-- ── 2) Parcela com pagamento maior que o valor previsto (não deveria existir — as RPCs
--       oficiais bloqueiam isso, então uma linha aqui indica uma escrita que passou por fora
--       delas) ──────────────────────────────────────────────────────────────────────────────
select id, servico_id, descricao, valor_previsto, valor_pago
from servico_parcelas
where valor_pago is not null and valor_pago > valor_previsto;

-- ── 3) Parcela cancelada que ainda tem valor pago (deveria ter sido estornada antes de
--       cancelar) ──────────────────────────────────────────────────────────────────────────
select id, servico_id, descricao, valor_previsto, valor_pago, cancelada_em
from servico_parcelas
where cancelada_em is not null and valor_pago is not null and valor_pago > 0;

-- ── 4) OS aprovada (numero preenchido) sem data de aprovação registrada ────────────────────
select id, numero, cliente, aprovado_em
from servicos
where numero is not null and aprovado_em is null;

-- ── 5) Fechamento mensal cujo lucro guardado não bate com entrou-saiu (sinal de edição
--       manual direta na tabela, ou bug futuro na hora de fechar) ─────────────────────────
select id, ano, mes, entrou, saiu, lucro, (entrou - saiu) as deveria_ser
from fechamentos_mensais
where lucro <> (entrou - saiu);

-- ── 6) Mesmo (ano, mes) fechado mais de uma vez (a constraint unique(ano,mes) já devia
--       impedir — 0 linhas esperado sempre) ───────────────────────────────────────────────
select ano, mes, count(*)
from fechamentos_mensais
group by ano, mes
having count(*) > 1;

-- ── 7) Despesa/receita pessoal com owner_id que não corresponde a nenhum perfil real ───────
select 'despesas_pessoais' as tabela, id, owner_id from despesas_pessoais d
where not exists (select 1 from profiles p where p.id = d.owner_id)
union all
select 'receitas_pessoais', id, owner_id from receitas_pessoais r
where not exists (select 1 from profiles p where p.id = r.owner_id)
union all
select 'contas_pessoais', id, owner_id from contas_pessoais c
where not exists (select 1 from profiles p where p.id = c.owner_id);

-- ── 8) Despesa/receita pessoal com valor pago/recebido maior que o previsto (mesma lógica
--       do item 2, lado pessoal) ───────────────────────────────────────────────────────────
select 'despesas_pessoais' as tabela, id, descricao, valor_previsto, valor_pago as valor_realizado
from despesas_pessoais where valor_pago > valor_previsto
union all
select 'receitas_pessoais', id, descricao, valor_previsto, valor_recebido
from receitas_pessoais where valor_recebido > valor_previsto;

-- ── 9) Itens de orçamento (orcamento_itens) apontando pra um serviço que não existe mais ──
select oi.id, oi.servico_id, oi.descricao
from orcamento_itens oi
left join servicos s on s.id = oi.servico_id
where s.id is null;

-- ── 10) Checklist/fotos/arquivos/medições órfãos (serviço já não existe) ──────────────────
select 'checklist_items' as tabela, ci.id, ci.servico_id from checklist_items ci
  left join servicos s on s.id = ci.servico_id where s.id is null
union all
select 'fotos', f.id, f.servico_id from fotos f
  left join servicos s on s.id = f.servico_id where s.id is null
union all
select 'arquivos', a.id, a.servico_id from arquivos a
  left join servicos s on s.id = a.servico_id where s.id is null
union all
select 'medicoes', m.id, m.servico_id from medicoes m
  left join servicos s on s.id = m.servico_id where s.id is null;

-- ── 11) Compra de cartão pessoal (parcela) com fatura_ano/fatura_mes vazios enquanto o
--        cartão existe e está ativo — indica uma parcela que nunca vai aparecer em nenhuma
--        fatura ─────────────────────────────────────────────────────────────────────────
select cc.id, cc.cartao_id, cc.descricao, cc.fatura_ano, cc.fatura_mes
from compras_cartao_pessoal cc
join cartoes_pessoais c on c.id = cc.cartao_id and c.ativo
where cc.cancelada_em is null and (cc.fatura_ano is null or cc.fatura_mes is null);
