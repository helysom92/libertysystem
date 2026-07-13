"use client";

import { useEffect, useState } from "react";
import type { ServicoDetail } from "@/lib/domain/types";
import { getSignedUrl, upsertFoto } from "@/lib/actions/servicoDetail";
import { createClient } from "@/lib/supabase/client";
import ImageDropzone from "@/components/dropzone/ImageDropzone";

export default function FotosTab({ detail }: { detail: ServicoDetail }) {
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
    } finally {
      setUploadingSlot(null);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((slot) => (
        <ImageDropzone
          key={slot}
          src={urls[slot] ?? null}
          placeholder="Foto"
          uploading={uploadingSlot === slot}
          onDrop={(file) => handleDrop(slot, file)}
        />
      ))}
    </div>
  );
}
