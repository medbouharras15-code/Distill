"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { buttonClasses } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(
        error.message === "User already registered"
          ? "Un compte existe déjà avec cet email."
          : error.message,
      );
      setLoading(false);
      return;
    }

    // Si la confirmation par email est activée sur le projet Supabase,
    // aucune session n'est ouverte immédiatement : on demande à
    // l'utilisateur de vérifier ses emails.
    if (!data.session) {
      setCheckEmail(true);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div className="flex flex-1 flex-col">
        <SiteHeader />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10 text-center animate-fade">
          <h1 className="mb-4 font-display text-3xl text-foreground">
            Vérifiez vos emails
          </h1>
          <p className="text-sm text-muted">
            Nous avons envoyé un lien de confirmation à <strong>{email}</strong>.
            Cliquez dessus pour activer votre compte, puis connectez-vous.
          </p>
          <Link
            href="/login"
            className="mt-6 font-medium text-accent-dark underline underline-offset-2"
          >
            Aller à la page de connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10 animate-fade">
        <h1 className="mb-8 text-center font-display text-3xl text-foreground">
          Créer un compte
        </h1>

        <form
          onSubmit={handleSubmit}
          className="rounded-[calc(var(--radius)+6px)] border border-border bg-card p-6 shadow-[var(--shadow-sm)]"
        >
          <label className="mb-1 block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-xl border border-border bg-background-alt p-3 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
          />

          <label className="mb-1 block text-sm font-medium text-foreground">
            Mot de passe
          </label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-1 w-full rounded-xl border border-border bg-background-alt p-3 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-light"
          />
          <p className="mb-4 text-xs text-muted">6 caractères minimum.</p>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className={buttonClasses("primary", "md", "w-full")}>
            {loading ? "Création…" : "Créer mon compte"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-accent-dark underline underline-offset-2">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
