"use client";

import { useState, useTransition } from "react";
import { createCliente } from "@/lib/actions/clientes";
import { lookupCnpj } from "@/lib/domain/cnpj";

export default function NovoClienteModal({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cidade, setCidade] = useState("");
  const [endereco, setEndereco] = useState("");
  const [pending, startTransition] = useTransition();
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookupCnpj() {
    setLooking(true);
    setError(null);
    try {
      const result = await lookupCnpj(cpfCnpj);
      if (!result) {
        setError("CNPJ não encontrado ou inválido.");
        return;
      }
      if (result.nome) setEmpresa(result.nome);
      if (result.cidade) setCidade(result.cidade);
      if (result.endereco) setEndereco(result.endereco);
      if (result.telefone && !whatsapp) setWhatsapp(result.telefone);
    } catch {
      setError("Não foi possível consultar o CNPJ agora.");
    } finally {
      setLooking(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome) {
      setError("Nome é obrigatório.");
      return;
    }
    startTransition(async () => {
      try {
        await createCliente({
          nome,
          empresa: empresa || null,
          cpf_cnpj: cpfCnpj || null,
          whatsapp: whatsapp || null,
          cidade: cidade || null,
          endereco: endereco || null,
        });
        onClose();
      } catch {
        setError("Não foi possível criar o cliente.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-card border border-border-gold bg-card p-6"
      >
        <h2 className="mb-4 font-display text-lg font-bold">Novo Cliente</h2>

        <label className="mb-1 block text-xs text-text-secondary">CPF/CNPJ</label>
        <div className="mb-3 flex gap-2">
          <input
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            placeholder="Só números, 14 dígitos p/ CNPJ"
            className="flex-1 rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleLookupCnpj}
            disabled={looking || cpfCnpj.replace(/\D/g, "").length !== 14}
            className="shrink-0 rounded-btn border border-border-gold-strong px-3 py-2 text-[12.5px] text-gold disabled:opacity-40"
          >
            {looking ? "Consultando..." : "Consultar CNPJ"}
          </button>
        </div>

        <label className="mb-1 block text-xs text-text-secondary">Nome / Razão Social</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Empresa</label>
        <input
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-xs text-text-secondary">Telefone / WhatsApp</label>
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className="mb-3 w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
        />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Cidade</label>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-text-secondary">Endereço</label>
            <input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="w-full rounded-btn border border-border-neutral bg-card-secondary px-3 py-2 text-sm"
            />
          </div>
        </div>

        <p className="mb-3 text-[11px] text-text-muted">
          Dados de CNPJ vêm de uma base pública gratuita e podem estar desatualizados — confira antes de confiar 100%.
        </p>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-4 py-2 text-sm text-text-secondary hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-btn bg-gradient-to-br from-gold-light via-gold-mid to-gold-dark px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60"
          >
            {pending ? "Criando..." : "Criar Cliente"}
          </button>
        </div>
      </form>
    </div>
  );
}
