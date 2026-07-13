"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-bg px-4">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-card border border-border-gold bg-card p-8"
      >
        <h1 className="font-display text-2xl font-bold text-gold">Liberty</h1>
        <p className="mb-6 text-xs tracking-wide text-text-muted uppercase">
          Sistema Operacional
        </p>

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
          className="mb-6 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm text-text outline-none focus:border-border-gold-strong"
        />

        {state?.error && <p className="mb-4 text-sm text-danger">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark py-2 text-sm font-semibold text-bg disabled:opacity-60"
        >
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
