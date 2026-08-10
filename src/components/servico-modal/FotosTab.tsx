"use client";

import { useEffect, useState } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { addFotoSlot, getSignedUrl, removeFoto, setCapaFoto, upsertFoto } from "@/lib/actions/servicoDetail";
import { createClient } from "@/lib/supabase/client";
import ImageDropzone from "@/components/dropzone/ImageDropzone";

export default function FotosTab({
  detail,
  onChanged,
}: {
  detail: ServicoDetail;
  onChanged: () => void;
}) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [addingSlot, setAddingSlot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown, fallback: string) {
    console.error(fallback, err);
    setError(err instanceof Error ? err.message : fallback);
    setTimeout(() => setError(null), 6000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const entries = await Promise.all(
        detail.fotos.map(async (foto) => {
          if (!foto.storage_path) return [foto.id, null] as const;
          const url = await getSignedUrl("fotos", foto.storage_path);
          return [foto.id, url] as const;
        })
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [detail.fotos]);

  async function handleDrop(fotoId: string, slot: number, file: File) {
    setUploadingId(fotoId);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${detail.servico.id}/slot-${slot}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("fotos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      await upsertFoto(detail.servico.id, slot, path);
      const url = await getSignedUrl("fotos", path);
      setUrls((u) => ({ ...u, [fotoId]: url }));
      onChanged();
    } catch (err) {
      showError(err, "Não foi possível enviar essa foto.");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleSetCapa(fotoId: string) {
    setError(null);
    try {
      await setCapaFoto(detail.servico.id, fotoId);
      onChanged();
    } catch (err) {
      showError(err, "Não foi possível definir essa foto como capa.");
    }
  }

  async function handleAddSlot() {
    setAddingSlot(true);
    setError(null);
    try {
      await addFotoSlot(detail.servico.id);
      onChanged();
    } catch (err) {
      showError(err, "Não foi possível adicionar um espaço de foto.");
    } finally {
      setAddingSlot(false);
    }
  }

  async function handleRemove(fotoId: string, storagePath: string | null) {
    setError(null);
    try {
      await removeFoto(fotoId, storagePath);
      onChanged();
    } catch (err) {
      showError(err, "Não foi possível remover essa foto.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-btn border border-danger-border bg-card px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-4">
        {detail.fotos.map((foto) => {
          const isCapa = foto.id === detail.servico.capa_foto_id;
          return (
            <div key={foto.id} className="flex flex-col gap-2">
              <ImageDropzone
                src={urls[foto.id] ?? null}
                placeholder="Foto"
                uploading={uploadingId === foto.id}
                onDrop={(file) => handleDrop(foto.id, foto.slot, file)}
              />
              <div className="flex items-center gap-1.5">
                {urls[foto.id] && (
                  <button
                    type="button"
                    onClick={() => handleSetCapa(foto.id)}
                    disabled={isCapa}
                    className={`flex-1 rounded-btn border px-2 py-1 text-[11px] ${
                      isCapa
                        ? "border-gold text-gold"
                        : "border-border-neutral text-text-secondary hover:text-text"
                    }`}
                  >
                    {isCapa ? "★ Capa do card" : "Definir como capa"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(foto.id, foto.storage_path)}
                  className="rounded-btn border border-danger-border px-2 py-1 text-[11px] text-danger"
                >
                  Remover
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleAddSlot}
        disabled={addingSlot}
        className="w-fit rounded-btn border border-dashed border-border-gold-strong px-3 py-1.5 text-[12px] text-text-secondary disabled:opacity-40"
      >
        {addingSlot ? "Adicionando..." : "+ Adicionar foto"}
      </button>
    </div>
  );
}
