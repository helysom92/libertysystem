"use client";

import { useActionState, useState } from "react";
import { signIn } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setForgotStatus("sending");
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotStatus("sent");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-card border border-border-gold bg-card p-8">
        <h1 className="font-display text-2xl font-bold text-gold">Liberty</h1>
        <p className="mb-6 text-xs tracking-wide text-text-muted uppercase">
          Sistema Operacional
        </p>

        {!forgotMode ? (
          <form key="login-form" action={formAction}>
            <label className="mb-1 block text-xs text-text-secondary">E-mail</label>
            <input
              name="email"
              type="email"
              required
              className="mb-4 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm text-text outline-none focus:border-border-gold-strong"
            />

            <label className="mb-1 block text-xs text-text-secondary">Senha</label>
            <input
              name="password"
              type="password"
              required
              className="mb-2 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm text-text outline-none focus:border-border-gold-strong"
            />

            <button
              type="button"
              onClick={() => setForgotMode(true)}
              className="mb-6 text-[12px] text-text-muted hover:text-gold hover:underline"
            >
              Esqueci minha senha
            </button>

            {state?.error && <p className="mb-4 text-sm text-danger">{state.error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark py-2 text-sm font-semibold text-bg disabled:opacity-60"
            >
              {pending ? "Entrando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form key="forgot-form" onSubmit={sendReset}>
            <label className="mb-1 block text-xs text-text-secondary">
              Digite seu e-mail para receber o link de redefinição
            </label>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              className="mb-4 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm text-text outline-none focus:border-border-gold-strong"
            />

            {forgotStatus === "sent" ? (
              <p className="mb-4 text-sm" style={{ color: "#25D366" }}>
                Se esse e-mail existir, um link foi enviado. Confira sua caixa de entrada.
              </p>
            ) : (
              <button
                type="submit"
                disabled={forgotStatus === "sending"}
                className="mb-3 w-full rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark py-2 text-sm font-semibold text-bg disabled:opacity-60"
              >
                {forgotStatus === "sending" ? "Enviando..." : "Enviar link"}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setForgotStatus("idle");
              }}
              className="w-full text-[12px] text-text-muted hover:text-text hover:underline"
            >
              Voltar para o login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
