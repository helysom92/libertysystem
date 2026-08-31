/**
 * Next.js 16 mascara toda mensagem de `throw` numa Server Action em produção (vira um texto
 * genérico + digest, sem a mensagem real — confirmado em teste manual e na doc oficial do
 * framework: "avoid using try/catch blocks and throw errors. Instead, model expected errors as
 * return values"). Por isso toda ação que precisa mostrar uma mensagem de bloqueio/erro pro
 * usuário devolve um desses tipos em vez de lançar — é a única forma confiável da mensagem
 * chegar de verdade na tela, em vez de um "An error occurred..." genérico.
 */
export type AcaoResultado = { ok: true } | { ok: false; message: string };
export type AcaoComSaldo = { ok: true; saldoRestante: number } | { ok: false; message: string };
