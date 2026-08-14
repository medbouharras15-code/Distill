import Link from "next/link";
import { AiOrb } from "@/components/Brand";
import { buttonClasses } from "@/components/ui";
import { FREE_GENERATIONS_LIMIT } from "@/lib/billing";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24 sm:px-8 sm:pb-32">
      <Reveal>
        <div className="relative overflow-hidden rounded-[calc(var(--radius)+18px)] border border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-lg)] sm:px-16 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full ai-gradient opacity-[0.12] blur-[100px]"
          />
          <div className="relative mx-auto flex max-w-lg flex-col items-center">
            <AiOrb size={44} active />
            <h2 className="mt-6 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
              Vos prochaines révisions commencent ici.
            </h2>
            <p className="mt-3 text-[15px] text-muted-foreground">
              {FREE_GENERATIONS_LIMIT} générations gratuites, sans carte bancaire.
            </p>
            <Link href="/signup" className={buttonClasses("primary", "lg", "mt-8")}>
              Créer un compte gratuit
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
