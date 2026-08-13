/** Symbole IA Distill — une goutte qui se distille en son essence.
 * Signature visuelle distinctive, réutilisée partout où l'IA Distill
 * apparaît (boutons, panneaux, résultats), plutôt qu'un logo de chatbot
 * générique. */
export function DistillMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2.5c3.3 4 5 6.6 5 9.4A5 5 0 0 1 12 17a5 5 0 0 1-5-5.1c0-2.8 1.7-5.4 5-9.4Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M12 2.5c3.3 4 5 6.6 5 9.4A5 5 0 0 1 12 17a5 5 0 0 1-5-5.1c0-2.8 1.7-5.4 5-9.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.6 11.6c0 1.4 1.1 2.5 2.4 2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 19v2.5M9 21h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Pastille "IA Distill" — orbe en dégradé aurore (jade → bleu → violet)
 * portant le symbole de la marque. `active` ajoute un halo pulsant discret
 * (utilisé quand le panneau IA est ouvert / une génération est en cours). */
export function AiOrb({ size = 32, active = false, className = "" }: { size?: number; active?: boolean; className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ai-gradient text-white ${active ? "ai-glow" : "shadow-[0_4px_12px_-4px_var(--ai-glow)]"} ${className}`}
      style={{ width: size, height: size }}
    >
      {active && <span className="absolute inset-0 rounded-full ai-gradient animate-aipulse opacity-50 blur-md" />}
      <span className="relative" style={{ lineHeight: 0 }}>
        <DistillMark size={size * 0.58} />
      </span>
    </span>
  );
}

/** Logotype "Distill" — marque + nom, taille ajustable pour la barre
 * latérale, l'écran de démarrage ou un en-tête compact. */
export function Wordmark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`group flex items-center gap-2.5 ${className}`}>
      <span className="text-accent transition-transform duration-300 group-hover:scale-110">
        <DistillMark size={size} />
      </span>
      <span className="font-display tracking-[-0.02em]" style={{ fontSize: size * 0.92, fontWeight: 500 }}>
        Distill
      </span>
    </span>
  );
}
