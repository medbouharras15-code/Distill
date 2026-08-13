import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Distill — Transformez vos notes en résumés et flashcards",
  description:
    "Collez vos notes de cours, une photo ou un PDF : Distill génère un résumé structuré et des flashcards de révision grâce à l'IA.",
};

// Appliqué avant l'hydratation pour éviter un flash de thème clair au
// chargement d'une page en mode sombre (lit la préférence enregistrée par
// ThemeToggle, ou à défaut la préférence système).
const themeInitScript = `(function(){try{var t=localStorage.getItem('distill-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${bricolage.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
      // Le script anti-flash ci-dessous ajoute la classe `dark` avant
      // l'hydratation (le serveur, lui, n'a pas accès à localStorage) :
      // l'écart qui en résulte sur cet élément précis est attendu et sans
      // conséquence, exactement comme pour tout composant de thème
      // (ex. next-themes) — on ne supprime les avertissements que sur ce
      // seul nœud, jamais ailleurs dans l'arbre.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
