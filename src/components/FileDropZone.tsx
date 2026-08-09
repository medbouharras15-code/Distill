"use client";

import { useRef, useState, type DragEvent } from "react";

export default function FileDropZone({
  label,
  hint,
  accept,
  file,
  onSelect,
  onClear,
}: {
  label: string;
  hint: string;
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
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex min-h-[7.5rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isDragging
            ? "border-accent bg-accent-light/30"
            : "border-border bg-background-alt hover:border-accent-light"
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
        {file ? (
          <div className="flex items-center gap-3">
            <span className="max-w-[12rem] truncate text-sm font-medium text-foreground">
              {file.name}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-xs font-medium text-accent-dark underline underline-offset-2 hover:text-accent"
            >
              Retirer
            </button>
          </div>
        ) : (
          <>
            <span className="text-sm text-muted">{hint}</span>
            <span className="mt-1 text-xs text-accent-dark">
              Cliquez ou glissez-déposez
            </span>
          </>
        )}
      </div>
    </div>
  );
}
