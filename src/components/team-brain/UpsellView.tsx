import Link from "next/link";
import { BackLink, Badge, Button, buttonClasses } from "@/components/ui";
import { Bolt, Brain, ChevronRight, Doc, FolderOpen, Lock, Shield, Users } from "@/lib/icons";
import { CreateTeamForm } from "./CreateTeamForm";

const FEATURES = [
  { icon: FolderOpen, label: "Projets & dossiers partagés", desc: "Organisez les documents par client ou sujet." },
  { icon: Brain, label: "Questions en langage naturel", desc: "« Qu'avons-nous décidé avec Nike ? »" },
  { icon: Doc, label: "Sources citées précisément", desc: "Document, page, date, auteur — toujours." },
  { icon: Shield, label: "Documents privés protégés", desc: "Visibles uniquement par leur propriétaire." },
  { icon: Users, label: "Rôles & permissions", desc: "Admin, Manager, Membre — contrôle fin." },
  { icon: Bolt, label: "Mises à jour en temps réel", desc: "L'IA apprend dès qu'un doc est ajouté." },
];

/** Écran affiché à quiconque n'appartient à aucune équipe Team Brain
 * réelle. "Créer mon équipe" (CreateTeamForm) crée une vraie équipe et
 * bascule automatiquement sur le vrai Workspace (voir le useEffect dédié
 * dans TeamBrain.tsx). "Explorer la démo" ne fait que basculer un état
 * local côté client, sans rien créer — la démo sur données mock reste
 * disponible pour quiconque préfère explorer sans engagement. */
export function UpsellView({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="mx-auto max-w-[700px] animate-fade px-5 py-10 md:px-10">
      <BackLink href="/dashboard" className="mb-8">
        Accueil
      </BackLink>

      <div className="paper-grain relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-md)] md:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(ellipse, var(--team) 0%, transparent 70%)" }}
        />

        <div className="relative">
          <div className="mb-6 flex items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_4px_20px_-6px_var(--team-glow)]"
              style={{ background: "linear-gradient(135deg, var(--team) 0%, var(--team-2) 100%)" }}
            >
              <Brain size={26} />
            </div>
            <div>
              <div className="font-display text-2xl font-medium tracking-tight text-foreground">Team Brain</div>
              <Badge className="mt-0.5 bg-secondary text-muted-foreground">
                <Lock size={10} /> Abonnement Team requis
              </Badge>
            </div>
          </div>

          <p className="max-w-[480px] text-[15px] leading-relaxed text-muted-foreground">
            Une mémoire collective que votre équipe peut interroger en langage naturel. Chaque membre ajoute ses
            notes, l&apos;IA répond en citant la source exacte — jamais de réponse inventée.
          </p>

          {/* Liste de fonctionnalités sans encadré — six boîtes bordées
              identiques auraient répété le même motif "grille de cartes"
              déjà retiré ailleurs sur le site ; ici juste icône + texte,
              avec assez de respiration pour se passer de bordure. */}
          <div className="mt-9 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: "color-mix(in srgb, var(--team) 85%, var(--team-2))" }}
                >
                  <Icon size={15} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-foreground">{label}</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-3">
            <CreateTeamForm />

            <div className="flex items-center gap-2 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={onUnlock}
                size="lg"
                className="flex-1"
                style={{
                  background: "linear-gradient(135deg, var(--team) 0%, var(--team-2) 100%)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1), 0 12px 28px -12px var(--team-glow)",
                }}
              >
                <Brain size={17} /> Explorer la démo Team Brain
              </Button>
              <Link href="/subscription" className={buttonClasses("outline", "lg")}>
                Voir les offres Team <ChevronRight size={15} />
              </Link>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            La démo utilise des données fictives · Aucune modification de vos données réelles
          </p>
        </div>
      </div>
    </div>
  );
}
