"use client";

import { useRef, useState } from "react";

/**
 * Drag-and-drop / click-to-browse image slot. Replaces the prototype's `image-slot.js`
 * web component (design-tool-only scaffolding, not portable — see plan §5): reimplements
 * only the UX contract (drop zone, click-to-browse, cover fit, placeholder text).
 */
export default function ImageDropzone({
  src,
  placeholder,
  onDrop,
  uploading,
}: {
  src: string | null;
  placeholder: string;
  onDrop: (file: File) => void;
  uploading?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onDrop(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-card border ${
        dragOver ? "border-gold bg-card" : "border-border-neutral bg-card-secondary"
      }`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="px-2 text-center text-[11.5px] text-text-muted">
          {uploading ? "Enviando..." : placeholder}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onDrop(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
