"use client";

/** Sélecteur − / + pour le nombre de lots de jetons à acheter — partagé par
 * le panneau IA (plafond atteint) et Paramètres > IA Distill (achat
 * proactif), voir JETONS_PACK_MIN_QUANTITY/MAX_QUANTITY dans @/lib/paddle. */
export function JetonsQuantityStepper({
  quantity,
  onChange,
  min,
  max,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-full border border-border bg-background-alt">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, quantity - 1))}
        disabled={quantity <= min}
        className="grid h-8 w-8 shrink-0 place-items-center text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Diminuer la quantité"
      >
        −
      </button>
      <span className="min-w-[26px] text-center text-[13px] font-semibold tabular-nums">{quantity}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, quantity + 1))}
        disabled={quantity >= max}
        className="grid h-8 w-8 shrink-0 place-items-center text-foreground transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Augmenter la quantité"
      >
        +
      </button>
    </div>
  );
}
