export default function VisaoGeralPessoalPage() {
  return (
    <div className="rounded-card border border-border-neutral bg-card p-6">
      <h1 className="mb-2 text-lg font-semibold text-text">Visão Geral</h1>
      <p className="text-[13px] text-text-secondary">
        Bloco A (isolamento e acesso) concluído — só o seu usuário chega até aqui. Os indicadores
        (recebido, a receber, saldo de contas, faturas a vencer, dívidas, investimentos) entram no
        Bloco B, junto de Contas e de Receitas e Despesas.
      </p>
    </div>
  );
}
