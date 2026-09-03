# Sistema Liberty

Sistema operacional interno da Liberty Visual e Marketing — substitui a plataforma paga
(ATRUPE/i9) por um sistema próprio: Kanban de orçamentos/OS, financeiro empresarial, CRM
comercial, gestão macro e um módulo isolado de finanças pessoais (uso exclusivo do
administrador).

Next.js 16 (App Router, Turbopack) + Supabase (Postgres, Auth, Storage). Deploy automático no
Vercel a cada `git push` pra `main`.

## Papéis e o que cada um vê

| Papel | Acesso |
|---|---|
| **Administrador** | Tudo — inclusive Gestão (números consolidados) e Finanças Pessoais (só se for o e-mail do dono, ver abaixo) |
| **Secretaria** | Hoje, Secretaria, Comercial, Financeiro, Produção — sem Gestão nem Finanças Pessoais |
| **Produção** | Só Produção — nunca vê valor, valor pago, status financeiro, parcelas, ou dado de cliente além do essencial pra executar o serviço |

Papel fica em `profiles.role`. Trocar o próprio papel é bloqueado no banco (trigger
`profiles_role_guard`, `0034_permissoes_papeis.sql`) — só Administrador muda o papel de
outro usuário.

**Finanças Pessoais é isolado por identidade, não por papel**: só o usuário com o e-mail
configurado em `is_helysom()` (`0038_financas_pessoais_isolamento.sql`) enxerga esse módulo,
mesmo que outro Administrador exista no sistema. Toda tabela do módulo exige
`owner_id = auth.uid() and is_helysom()` na RLS.

## Módulos (`src/app/(dashboard)/`)

- **`hoje/`** — central de atenção: KPIs do papel, "Meu Trabalho", Alertas da IA (por serviço),
  Alertas Comerciais e Alertas Pessoais (Etapa 8) — tudo só leitura, nenhuma ação automática.
- **`comercial/`** — Kanban de Orçamentos (`OrcamentoModal`) e de Ordens de Serviço
  (`CentralDoServico`), Propostas, Indicadores (funil comercial — Etapa 5).
- **`financeiro/`** — lançamentos, recebimentos, despesas, comprovantes; Visão Geral mostra só
  pendências do dia a dia (sem número de resultado — isso é papel de Gestão).
- **`gestao/`** — só Administrador: Visão Geral (indicadores oficiais + OS/propostas em
  atenção), Comparativo, Histórico, Relatórios, Metas, Conferência (fechamento mensal).
- **`producao/`** — Kanban de OS em contexto restrito, Agenda, Visão Geral — nunca recebe dado
  financeiro do servidor, nem em bloco nem por campo.
- **`secretaria/`** — Clientes, Fornecedores, Produtos/Catálogo, Visão Geral operacional.
- **`financas-pessoais/`** — Visão Geral, Receitas/Despesas, Contas/Transferências,
  Cartões/Faturas, Dívidas, Investimentos, Importações (CSV/PDF, com proteção contra
  duplicata — Etapa 7.1). Completamente isolado do financeiro empresarial.

## Conceitos financeiros oficiais (empresarial)

Definidos uma única vez em `src/lib/domain/financas.ts` — **nenhum componente React
recalcula essas fórmulas**; todo lugar que mostra um desses números chama a função oficial.

- **Vendas Aprovadas** — OS com `numero` atribuído e `aprovado_em` no período, excluindo
  `financeiro_status = 'Cancelado'` (`vendasAprovadas`).
- **Faturamento Contratado** — o `total` de Vendas Aprovadas (mesma função).
- **Recebido** / **Despesas Pagas** — soma de `lancamentos` com `status = 'realizado'` no
  período, por tipo (`recebido`, `despesasPagas`).
- **A Receber** / **A Pagar** — saldo em aberto de parcelas/despesas com vencimento no
  período, com a sublista de **vencidos** já separada (`aReceber`, `aPagar`).
- **Resultado Realizado de Caixa** = Recebido − Despesas Pagas.
- **Resultado Pendente** = A Receber − A Pagar.
- **Resultado Previsto Final** = Recebido + A Receber − Despesas Pagas − A Pagar.

**Nunca chamamos o Resultado Realizado de "Lucro Líquido"** — lucro de verdade (com custo
direto, margem por OS) é escopo futuro, fora do que este sistema calcula hoje (ver
"Rentabilidade por OS" no backlog, Etapa Futura). A série mensal usada em Gestão
(`serieMensalOficial`) é só um substituto drop-in de uma versão antiga que recalculava por
conta própria — ela também chama `recebido`/`despesasPagas` por baixo, nunca duplica a conta.

Finanças Pessoais tem seu próprio conjunto equivalente em `src/lib/domain/financasPessoais.ts`
(`receitasRecebidasNoMes`, `despesasPagasNoMes`, `patrimonioLiquido`, etc.) — deliberadamente
**não** compartilha código com `financas.ts` além dos tipos de envelope (`IndicadorFinanceiro`),
pra manter os dois domínios isolados de verdade.

## Segurança — o que já foi corrigido (Etapa 4A) e o que se mantém como regra

- Toda função `security definer` sensível teve `EXECUTE` revogado de `PUBLIC` e de `anon`/
  `authenticated` por padrão, concedido de volta só pra quem precisa (migrations 0046, 0051).
  As únicas 3 RPCs deliberadamente públicas (link de proposta) usam o token aleatório como
  controle de acesso real, não a ausência de GRANT.
- RPCs financeiras/comerciais validam o papel de quem chama **dentro de si mesmas**
  (`is_admin_or_secretaria()`), não só na Server Action do Next.js — uma chamada direta à API
  REST do Supabase com uma sessão de Produção não basta mais (migration 0050).
- RLS de `clientes`/`orcamento_itens` restrita a admin/secretaria (Produção usa só as funções
  seguras `get_servico_producao`/`listar_servicos_producao`, que devolvem campo escrutinado).
- `get_proposta_publica` calcula o preço **dentro** da função — nunca serializa
  `custo_direto`/`preco_m2_manual`/catálogo completo pro visitante anônimo (migration 0047).
- Histórico financeiro nunca é apagado por exclusão comum — triggers bloqueiam `DELETE` em
  `servicos`/`lancamentos`/`servico_parcelas` com dinheiro já movimentado; use
  Cancelar/Estornar. `financeiro_eventos` é append-only (sem policy de update/delete).

**Ao adicionar uma RPC nova**: sempre checar papel internamente se ela mexe em dinheiro ou
dado sensível — não confiar só na Server Action que a chama.

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:3000
npm run test     # Vitest — só funções puras de src/lib/domain, sem banco
npm run lint     # ESLint
npm run build    # build de produção + type-check completo
```

`npx tsc --noEmit` roda um type-check mais rigoroso que `next build` sozinho (pega erro em
arquivo de teste que o build de produção ignora) — vale rodar antes de commitar mudança grande.

### Variáveis de ambiente (`.env.local`)

| Variável | Obrigatória | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | Chave pública (anon) — respeita RLS |
| `ANTHROPIC_API_KEY` | não | Só pra leitura de extrato em PDF por IA (Finanças Pessoais). Sem ela, o caminho de CSV/texto colado continua funcionando 100% local |

Nenhuma `service_role` key é usada em nenhum lugar do app — todo acesso passa pela `anon` key
mais RLS, mesmo no servidor (Server Components/Actions usam a sessão do usuário via cookie).

## Migrations

54 migrations em `supabase/migrations/`, numeradas sequencialmente (`0001` a `0054`). **Regra
inegociável: nunca editar uma migration já aplicada** — toda mudança de schema é uma migration
nova, mesmo que corrija algo de uma migration antiga (ex: `0044` corrige um bug de `0042`;
`0051` corrige um GRANT que `0046` tinha feito errado). Isso preserva o histórico real do banco
e evita divergência entre ambientes.

Como este projeto não tem Supabase CLI linkado localmente pra migrations automáticas, o fluxo
é manual: o SQL de cada migration nova é colado no SQL Editor do Supabase (produção — não há
ambiente de homologação separado) e rodado uma vez.

## Backup e recuperação (documentado — nenhuma rotina automática implementada)

Não existe hoje nenhum job agendado de backup/exportação — isso é deliberado (a Etapa 9 do
plano de evolução pede pra **documentar** a estratégia, não implementar uma rotina destrutiva
automática sem supervisão). Até que isso mude:

- **Backup do banco**: o Supabase já mantém backup automático diário no plano do projeto
  (retenção conforme o plano contratado — conferir em Project Settings → Database → Backups no
  painel do Supabase). Restauração é feita por ali, point-in-time conforme disponibilidade do
  plano.
- **Exportação manual sob demanda**: qualquer tabela pode ser exportada via SQL Editor
  (`select * from tabela` → Export CSV) ou via `pg_dump` apontando pra connection string do
  projeto (Project Settings → Database → Connection string).
- **Storage** (fotos, arquivos, extratos): buckets `fotos`, `arquivos`, `financas-pessoais` —
  sem backup automático próprio além do que o Supabase já oferece pro Storage do plano.
  Arquivos de extrato pessoal são deliberadamente apagados após a leitura (nunca ficam
  retidos no bucket).
- **Antes de qualquer migration**: revisar o SQL com calma antes de rodar — não existe
  ambiente de homologação separado pra testar primeiro.

## Testes

`npm run test` roda Vitest sobre `src/lib/domain/**/__tests__/*.test.ts` — só funções puras
(sem mock de banco). Regras que dependem de RLS/RPC (autorização, isolamento entre usuários,
proteção de exclusão) são verificadas por chamada real contra o Supabase de produção durante o
desenvolvimento (documentado nos commits/relatórios de cada etapa), não por um Vitest com mock
— este projeto não usa um banco de teste separado.
