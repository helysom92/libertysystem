"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, type Role } from "@/lib/domain/flows";
import type { Profile } from "@/lib/supabase/profile";
import { updateUserRole } from "@/lib/actions/usuarios";

const ROLES: Role[] = ["administrador", "secretaria", "producao"];

function LinhaUsuario({ usuario }: { usuario: Profile }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(usuario.role);
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = role !== usuario.role;

  function salvar() {
    setError(null);
    startTransition(async () => {
      const resultado = await updateUserRole(usuario.id, role);
      if (!resultado.ok) {
        setError(resultado.message);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-btn bg-card-secondary px-4 py-3">
      <div>
        <p className="text-sm font-semibold">{usuario.nome}</p>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-btn border border-border-neutral bg-card px-3 py-1.5 text-[12.5px]"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={salvar}
          disabled={!dirty || saving}
          className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-3 py-1.5 text-[12.5px] font-semibold text-bg disabled:opacity-40"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

/** Só Administrador acessa essa aba (já garantido pela guarda de /gestao) — atribui a função
 * de quem já tem conta criada no Supabase; criar/convidar usuário continua sendo feito por
 * fora, direto no Supabase. */
export default function UsuariosView({ usuarios }: { usuarios: Profile[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold">Usuários</h2>
        <p className="text-[13px] text-text-secondary">
          Só Administrador pode alterar a função de alguém. Criar um usuário novo continua sendo feito no Supabase.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {usuarios.map((u) => (
          <LinhaUsuario key={u.id} usuario={u} />
        ))}
        {usuarios.length === 0 && <p className="text-sm text-text-muted">Nenhum usuário encontrado.</p>}
      </div>
    </div>
  );
}
