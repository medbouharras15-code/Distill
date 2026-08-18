"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Check } from "@/lib/icons";

export default function FileDropZone({
  label,
  hint,
  icon,
  accept,
  file,
  onSelect,
  onClear,
}: {
  label: string;
  hint: string;
  icon: ReactNode;
  accept: string;
  file: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onSelect(dropped);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`group relative flex cursor-pointer flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 ${
        isDragging
          ? "border-accent bg-accent-light/40 shadow-[0_0_0_2px_var(--accent)]"
          : file
            ? "border-[color-mix(in_srgb,var(--ai-1)_45%,transparent)] bg-[color-mix(in_srgb,var(--ai-1)_6%,var(--card))]"
            : "border-border bg-card hover:border-accent/40 hover:shadow-[var(--shadow-sm)]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onSelect(selected);
          e.target.value = "";
        }}
      />

      {file && <span className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}

      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
          file
            ? "bg-[color-mix(in_srgb,var(--ai-1)_18%,transparent)] text-[var(--ai-1)]"
            : "bg-background-alt text-muted-foreground group-hover:bg-accent-light group-hover:text-accent-dark"
        }`}
      >
        {file ? <Check size={18} /> : icon}
      </span>

      <div className="w-full min-w-0">
        <div className="text-[13px] font-semibold text-foreground">{label}</div>
        {file ? (
          <div className="mt-1 flex items-center gap-2">
            <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{file.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="shrink-0 text-[11px] font-medium text-accent-dark underline underline-offset-2 hover:text-accent"
            >
              Retirer
            </button>
          </div>
        ) : (
          <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{hint}</div>
        )}
      </div>

      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-card/90 text-[13px] font-medium text-accent-dark">
          Déposer ici
        </div>
      )}
    </div>
  );
}
