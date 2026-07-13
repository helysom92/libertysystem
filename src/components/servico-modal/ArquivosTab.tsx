"use client";

import { useRef, useState, useTransition } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { addArquivo, getSignedUrl, removeArquivo } from "@/lib/actions/servicoDetail";
import { createClient } from "@/lib/supabase/client";

export default function ArquivosTab({
  detail,
  onChanged,
}: {
  detail: ServicoDetail;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const path = `${detail.servico.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("arquivos").upload(path, file);
        if (uploadErr) throw uploadErr;
        await addArquivo(detail.servico.id, file.name, path, file.size, file.type);
        onChanged();
      } catch {
        setError("Falha ao enviar arquivo.");
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  async function openFile(path: string) {
    const url = await getSignedUrl("arquivos", path);
    if (url) window.open(url, "_blank");
  }

  function handleRemove(id: string, path: string) {
    startTransition(async () => {
      await removeArquivo(id, path);
      onChanged();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-btn border border-border-gold-strong px-4 py-2 text-sm text-gold">
        {pending ? "Enviando..." : "+ Adicionar Arquivo"}
        <input ref={inputRef} type="file" className="hidden" onChange={handleFile} disabled={pending} />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        {detail.arquivos.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-card border border-border-neutral bg-card-secondary px-3 py-2 text-[12.5px]"
          >
            <button type="button" onClick={() => openFile(a.storage_path)} className="hover:text-gold">
              {a.nome}
            </button>
            <button
              type="button"
              onClick={() => handleRemove(a.id, a.storage_path)}
              className="text-danger"
            >
              Remover
            </button>
          </div>
        ))}
        {detail.arquivos.length === 0 && (
          <p className="text-sm text-text-muted">Nenhum arquivo anexado.</p>
        )}
      </div>
    </div>
  );
}
