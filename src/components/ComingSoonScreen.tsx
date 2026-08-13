import { Card } from "@/components/ui";

/** Écran temporaire pour les destinations de la nouvelle navigation pas
 * encore construites (voir la refonte de navigation démarrée en Phase 3) —
 * évite les liens morts pendant que chaque écran est livré un par un. À
 * supprimer dès que l'écran réel correspondant est en place. */
export function ComingSoonScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mx-auto flex max-w-[720px] animate-fade flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-medium tracking-[-0.02em] text-foreground">{title}</h1>
      <p className="mt-2 max-w-sm text-[15px] text-muted-foreground">{subtitle}</p>
      <Card className="mt-8 px-5 py-3 text-sm text-muted-foreground">Bientôt disponible.</Card>
    </div>
  );
}
