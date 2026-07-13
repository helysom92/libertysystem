"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");

    const sessionPromise =
      access_token && refresh_token
        ? createClient().auth.setSession({ access_token, refresh_token })
        : Promise.resolve({ error: new Error("missing tokens") });

    sessionPromise.then(({ error: sessionError }) => {
      if (sessionError) {
        setError("Link inválido ou expirado. Solicite um novo link de redefinição de senha.");
      } else {
        setReady(true);
      }
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError("Não foi possível atualizar a senha. Tente novamente.");
      return;
    }

    router.replace("/hoje");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-card border border-border-gold bg-card p-8">
        <h1 className="font-display text-2xl font-bold text-gold">Liberty</h1>
        <p className="mb-6 text-xs tracking-wide text-text-muted uppercase">Definir Nova Senha</p>

        {!ready && !error && <p className="text-sm text-text-secondary">Validando link...</p>}

        {ready && (
          <form onSubmit={submit}>
            <label className="mb-1 block text-xs text-text-secondary">Nova senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mb-4 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm text-text outline-none focus:border-border-gold-strong"
            />

            <label className="mb-1 block text-xs text-text-secondary">Confirmar senha</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="mb-6 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm text-text outline-none focus:border-border-gold-strong"
            />

            {error && <p className="mb-4 text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark py-2 text-sm font-semibold text-bg disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Salvar Nova Senha"}
            </button>
          </form>
        )}

        {!ready && error && (
          <>
            <p className="mb-4 text-sm text-danger">{error}</p>
            <a href="/login" className="text-sm text-gold underline-offset-2 hover:underline">
              Voltar para o login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
