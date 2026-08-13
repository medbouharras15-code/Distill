"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import { mockNotebooks } from "@/lib/appMockData";
import { Check, ChevronLeft, Clock, Doc, Pen } from "@/lib/icons";

interface ProfileFormProps {
  email: string;
  subscribed: boolean;
  memberSince: string;
}

const totalPages = mockNotebooks.reduce((sum, n) => sum + n.pages, 0);

/** Formulaire de profil — sur le modèle du Figma Make (Profile.tsx). Nom,
 * bio, établissement et niveau n'existent pas encore dans le modèle de
 * données réel (@/lib/types → Profile) : ils restent de simples champs
 * locaux, non persistés, comme dans la référence — à brancher à de vrais
 * champs une fois cette phase de design validée. Email, statut d'abonnement
 * et date d'inscription, eux, viennent du vrai profil utilisateur. */
export function ProfileForm({ email, subscribed, memberSince }: ProfileFormProps) {
  const defaultName = email.split("@")[0] || "Mon profil";
  const [name, setName] = useState(defaultName);
  const [bio, setBio] = useState("");
  const [school, setSchool] = useState("");
  const [level, setLevel] = useState("Terminale S");
  const [saved, setSaved] = useState(false);
  const initial = (email[0] ?? "?").toUpperCase();

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="mx-auto max-w-[720px] animate-fade px-6 py-8 md:px-10 md:py-12">
      <Link href="/settings" className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
        <ChevronLeft size={16} /> Paramètres
      </Link>

      <h1 className="font-display text-4xl font-medium tracking-[-0.02em] text-foreground">Mon profil</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">Tes informations et statistiques personnelles.</p>

      {/* Avatar */}
      <div className="mt-10 flex flex-col items-center gap-5">
        <div className="relative">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary text-4xl font-semibold text-primary-foreground shadow-[var(--shadow-lg)]">
            {initial}
          </div>
          <button
            type="button"
            aria-label="Modifier la photo"
            className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-secondary text-muted-foreground shadow-[var(--shadow-sm)] transition hover:text-foreground"
          >
            <Pen size={14} />
          </button>
        </div>
        <div className="text-center">
          <div className="font-display text-2xl font-medium text-foreground">{name || defaultName}</div>
          <div className="mt-1 text-sm text-muted-foreground">{email}</div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge className={subscribed ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}>
              {subscribed ? "Distill Pro" : "Offre gratuite"}
            </Badge>
            <span className="text-xs text-muted-foreground">Membre depuis {memberSince}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-10 grid grid-cols-3 gap-4">
        {[
          { label: "Carnets", value: String(mockNotebooks.length), icon: Doc },
          { label: "Pages", value: String(totalPages), icon: Doc },
          { label: "Jours actifs", value: "47", icon: Clock },
        ].map((stat) => (
          <Card key={stat.label} className="p-5 text-center">
            <div className="font-display text-3xl font-medium text-foreground">{stat.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Edit form */}
      <Card className="mt-8 p-6">
        <div className="mb-5 text-sm font-semibold text-foreground">Informations</div>
        <div className="space-y-5">
          <Field label="Nom affiché">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Ton prénom et nom"
            />
          </Field>
          <Field label="Bio courte">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Quelques mots sur toi…"
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Établissement">
              <input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Lycée, université…"
              />
            </Field>
            <Field label="Niveau d'étude">
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none"
              >
                {["Collège", "Seconde", "Première", "Terminale S", "Terminale L", "Licence 1", "Licence 2", "Licence 3", "Master", "Doctorat"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Adresse e-mail">
            <input
              value={email}
              readOnly
              className="w-full cursor-not-allowed rounded-xl border border-border bg-background-alt px-4 py-2.5 text-sm text-muted-foreground outline-none"
            />
          </Field>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <Link href="/settings" className="text-sm text-muted-foreground transition hover:text-foreground">
            Annuler
          </Link>
          <Button size="sm" onClick={handleSave} className="min-w-[120px]">
            {saved ? (
              <>
                <Check size={16} /> Enregistré
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="mt-6 overflow-hidden border-red-200 dark:border-red-900/40">
        <div className="px-6 py-4">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-red-500">Zone de danger</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Supprimer le compte</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Efface définitivement toutes tes données Distill.</div>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0 rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-500">
              Supprimer
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
