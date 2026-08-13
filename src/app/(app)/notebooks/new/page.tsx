"use client";

import { useState } from "react";
import Link from "next/link";
import { SheetPreview } from "@/components/notes/SheetPreview";
import { Check, ChevronLeft } from "@/lib/icons";
import { NOTEBOOK_COLORS, SHEET_TYPE_GROUPS } from "@/lib/appMockData";
import { Eyebrow, buttonClasses } from "@/components/ui";
import { PAPER_SIZES, SHEET_TYPES } from "@/lib/notes/sheets";
import type { SheetType } from "@/lib/notes/types";

export default function NewNotebookPage() {
  const [name, setName] = useState("");
  const [color, setColor] = useState(NOTEBOOK_COLORS[0]);
  const [sheetType, setSheetType] = useState<SheetType>("cornell");

  const ratio = PAPER_SIZES[0].ratio;
  const sheetLabel = SHEET_TYPES.find((s) => s.value === sheetType)?.label ?? sheetType;

  return (
    <div className="mx-auto max-w-[1180px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <Link href="/notebooks" className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={16} /> Mes carnets
      </Link>

      <div className="grid gap-10 lg:grid-cols-[340px_1fr]">
        {/* Config */}
        <div>
          <Eyebrow>Étape 1 · 2</Eyebrow>
          <h1 className="mt-3 font-display text-4xl font-medium tracking-[-0.02em] text-foreground">Nouveau carnet</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Donne-lui un nom, une couleur et un type de feuille.</p>

          <div className="mt-8 space-y-6">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Nom du carnet</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Biologie cellulaire"
                className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <div>
              <span className="text-sm font-medium text-foreground">Couleur</span>
              <div className="mt-2 flex gap-2.5">
                {NOTEBOOK_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={c}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition"
                    style={{ background: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 3 }}
                  >
                    {color === c && <Check size={16} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 text-xs font-medium text-muted-foreground">Aperçu</div>
              <div className="h-40 w-full overflow-hidden rounded-lg">
                <SheetPreview sheetType={sheetType} backgroundColor="#ffffff" ratio={ratio} width={280} />
              </div>
              <div className="mt-3 font-medium text-foreground">{name || "Carnet sans titre"}</div>
              <div className="text-xs text-muted-foreground">{sheetLabel}</div>
            </div>

            <Link href="/notes" className={buttonClasses("primary", "lg", "w-full")}>
              Créer et ouvrir
            </Link>
          </div>
        </div>

        {/* Sheet type chooser */}
        <div>
          <h2 className="text-sm font-semibold text-foreground">Choix du type de feuille</h2>
          <p className="mt-1 text-sm text-muted-foreground">16 modèles pensés pour chaque matière.</p>
          {SHEET_TYPE_GROUPS.map((group) => (
            <div key={group.label} className="mt-6">
              <Eyebrow>{group.label}</Eyebrow>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {group.types.map((id) => {
                  const label = SHEET_TYPES.find((s) => s.value === id)?.label ?? id;
                  const on = sheetType === id;
                  return (
                    <button key={id} type="button" onClick={() => setSheetType(id)} className="group text-left">
                      <div
                        className={`overflow-hidden rounded-xl border-2 bg-card transition ${
                          on ? "border-primary" : "border-border group-hover:border-muted-foreground/40"
                        }`}
                      >
                        <div className="relative h-24 overflow-hidden">
                          <SheetPreview sheetType={id} backgroundColor="#ffffff" ratio={4 / 3} width={140} />
                          {on && (
                            <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check size={13} />
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`mt-1.5 text-[13px] ${on ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
