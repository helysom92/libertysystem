"use client";

import { useEffect, useState } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { getSignedUrl, setCapaFoto, upsertFoto } from "@/lib/actions/servicoDetail";
import { createClient } from "@/lib/supabase/client";
import ImageDropzone from "@/components/dropzone/ImageDropzone";

export default function FotosTab({
  detail,
  onChanged,
}: {
  detail: ServicoDetail;
  onChanged: () => void;
}) {
  const [urls, setUrls] = useState<Record<number, string | null>>({});
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const entries = await Promise.all(
        [1, 2, 3].map(async (slot) => {
          const foto = detail.fotos.find((f) => f.slot === slot);
          if (!foto?.storage_path) return [slot, null] as const;
          const url = await getSignedUrl("fotos", foto.storage_path);
          return [slot, url] as const;
        })
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [detail.fotos]);

  async function handleDrop(slot: number, file: File) {
    setUploadingSlot(slot);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${detail.servico.id}/slot-${slot}.${ext}`;
      const { error } = await supabase.storage.from("fotos").upload(path, file, { upsert: true });
      if (error) throw error;
      await upsertFoto(detail.servico.id, slot, path);
      const url = await getSignedUrl("fotos", path);
      setUrls((u) => ({ ...u, [slot]: url }));
      onChanged();
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleSetCapa(slot: number) {
    const foto = detail.fotos.find((f) => f.slot === slot);
    if (!foto) return;
    await setCapaFoto(detail.servico.id, foto.id);
    onChanged();
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((slot) => {
        const foto = detail.fotos.find((f) => f.slot === slot);
        const isCapa = foto && foto.id === detail.servico.capa_foto_id;
        return (
          <div key={slot} className="flex flex-col gap-2">
            <ImageDropzone
              src={urls[slot] ?? null}
              placeholder="Foto"
              uploading={uploadingSlot === slot}
              onDrop={(file) => handleDrop(slot, file)}
            />
            {urls[slot] && (
              <button
                type="button"
                onClick={() => handleSetCapa(slot)}
                disabled={isCapa}
                className={`rounded-btn border px-2 py-1 text-[11px] ${
                  isCapa
                    ? "border-gold text-gold"
                    : "border-border-neutral text-text-secondary hover:text-text"
                }`}
              >
                {isCapa ? "★ Capa do card" : "Definir como capa"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
