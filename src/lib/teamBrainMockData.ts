/** Données statiques (mock) pour la démo Team Brain — design uniquement,
 * voir @/components/team-brain. Reprend fidèlement les données du prototype
 * Figma Make ("Agence ABC" / projet client Nike) : aucune de ces valeurs
 * n'est réelle, aucune n'est lue ni écrite en base de données. */

export interface TeamBrainProject {
  id: string;
  name: string;
  emoji: string;
  color: string;
  docs: number;
  lastActivity: string;
  members: string[];
}

export interface TeamBrainDoc {
  id: string;
  name: string;
  type: "note" | "pdf" | "doc";
  addedBy: string;
  initials: string;
  avatarColor: string;
  date: string;
  pages: number;
  private?: boolean;
}

export interface TeamBrainMember {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: "admin" | "manager" | "member";
  projects: string[];
  joinedAt: string;
}

export interface TeamBrainChatSource {
  doc: string;
  addedBy: string;
  date: string;
  page: number;
  excerpt: string;
}

export interface TeamBrainChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  source?: TeamBrainChatSource;
  ts: string;
}

export const TEAM_BRAIN_WORKSPACE = { name: "Agence ABC", plan: "Team Brain Pro", members: 5 };

export const TEAM_BRAIN_PROJECTS: TeamBrainProject[] = [
  {
    id: "nike",
    name: "Client Nike",
    emoji: "👟",
    color: "#b5693a",
    docs: 8,
    lastActivity: "Aujourd'hui",
    members: ["SM", "TK", "LD"],
  },
  {
    id: "reunions",
    name: "Réunions internes",
    emoji: "📋",
    color: "#0c6b52",
    docs: 14,
    lastActivity: "9 août",
    members: ["SM", "TK", "LD", "AR", "ML"],
  },
  {
    id: "contrats",
    name: "Contrats & devis",
    emoji: "📄",
    color: "#4b5d8b",
    docs: 5,
    lastActivity: "1er août",
    members: ["ML", "SM"],
  },
  {
    id: "strategie",
    name: "Stratégie 2025",
    emoji: "🎯",
    color: "#6b4b8b",
    docs: 3,
    lastActivity: "28 juil.",
    members: ["ML", "TK"],
  },
];

export const TEAM_BRAIN_NIKE_DOCS: TeamBrainDoc[] = [
  {
    id: "d1",
    name: "Brief créatif Nike — Campagne automne",
    type: "doc",
    addedBy: "Sophie M.",
    initials: "SM",
    avatarColor: "#b5693a",
    date: "12 août",
    pages: 8,
    private: false,
  },
  {
    id: "d2",
    name: "Réunion du 12 août — Notes",
    type: "note",
    addedBy: "Thomas K.",
    initials: "TK",
    avatarColor: "#0c6b52",
    date: "12 août",
    pages: 4,
    private: false,
  },
  {
    id: "d3",
    name: "Maquettes landing page v2",
    type: "pdf",
    addedBy: "Lucas D.",
    initials: "LD",
    avatarColor: "#4b5d8b",
    date: "10 août",
    pages: 12,
    private: false,
  },
  {
    id: "d4",
    name: "Feedback client — 8 août",
    type: "note",
    addedBy: "Sophie M.",
    initials: "SM",
    avatarColor: "#b5693a",
    date: "8 août",
    pages: 2,
    private: false,
  },
  {
    id: "d5",
    name: "Mes notes perso — brief Nike",
    type: "note",
    addedBy: "Thomas K.",
    initials: "TK",
    avatarColor: "#0c6b52",
    date: "7 août",
    pages: 3,
    private: true,
  },
  {
    id: "d6",
    name: "Contrat prestation Nike",
    type: "pdf",
    addedBy: "Admin",
    initials: "ML",
    avatarColor: "#6b4b8b",
    date: "3 août",
    pages: 6,
    private: false,
  },
];

export const TEAM_BRAIN_MEMBERS: TeamBrainMember[] = [
  {
    id: "ml",
    name: "Marie L.",
    initials: "ML",
    color: "#6b4b8b",
    role: "admin",
    projects: ["Tous les projets"],
    joinedAt: "Fondatrice",
  },
  {
    id: "tk",
    name: "Thomas K.",
    initials: "TK",
    color: "#0c6b52",
    role: "manager",
    projects: ["Client Nike", "Réunions internes", "Stratégie 2025"],
    joinedAt: "Depuis mars 2024",
  },
  {
    id: "sm",
    name: "Sophie M.",
    initials: "SM",
    color: "#b5693a",
    role: "member",
    projects: ["Client Nike", "Réunions internes", "Contrats & devis"],
    joinedAt: "Depuis juin 2024",
  },
  {
    id: "ld",
    name: "Lucas D.",
    initials: "LD",
    color: "#4b5d8b",
    role: "member",
    projects: ["Client Nike", "Réunions internes"],
    joinedAt: "Depuis juillet 2024",
  },
  {
    id: "ar",
    name: "Alex R.",
    initials: "AR",
    color: "#4b8b6b",
    role: "member",
    projects: ["Réunions internes"],
    joinedAt: "Depuis août 2024",
  },
];

export const TEAM_BRAIN_SEED_CHAT: TeamBrainChatMessage[] = [
  {
    id: "q1",
    role: "user",
    ts: "14:18",
    text: "Qu'avons-nous décidé avec Nike concernant le site ?",
  },
  {
    id: "a1",
    role: "ai",
    ts: "14:18",
    text: "D'après les notes de la réunion du 12 août (ajoutées par Thomas K.), le lancement du site est confirmé en septembre. La décision principale : un design épuré, sans carrousel, avec le coloris « Obsidian Black » comme couleur dominante de la page d'accueil. Cette décision a été validée en présence du responsable digital Nike.",
    source: {
      doc: "Réunion du 12 août — Notes",
      addedBy: "Thomas K.",
      date: "12 août",
      page: 4,
      excerpt:
        "Décision confirmée : lancement septembre. Design épuré, sans carrousel. Couleur dominante : Obsidian Black. Validé par Julien R. (Nike Digital).",
    },
  },
  {
    id: "q2",
    role: "user",
    ts: "14:21",
    text: "Et quel est le budget total validé pour ce projet ?",
  },
  {
    id: "a2",
    role: "ai",
    ts: "14:21",
    text: "Selon le contrat de prestation Nike (ajouté par Admin le 3 août), le budget global est fixé à 48 000 € TTC, avec un acompte de démarrage de 15 000 € payable à la signature. Un second versement de 18 000 € est prévu à la livraison des maquettes validées.",
    source: {
      doc: "Contrat prestation Nike",
      addedBy: "Admin (Marie L.)",
      date: "3 août",
      page: 2,
      excerpt:
        "Budget total : 48 000 € TTC. Acompte signature : 15 000 €. Versement intermédiaire (maquettes validées) : 18 000 €. Solde : 15 000 €.",
    },
  },
];

export const TEAM_BRAIN_AI_REPLY: TeamBrainChatMessage = {
  id: "a-new",
  role: "ai",
  ts: "",
  text: "D'après le brief créatif (Sophie M., 12 août), la campagne automne Nike cible les 18-28 ans et s'articule autour du thème « Everyday Champion ». Les visuels doivent montrer des sportifs urbains en contexte quotidien. Tu trouveras aussi dans les maquettes de Lucas (page 7) les déclinaisons mobile validées.",
  source: {
    doc: "Brief créatif Nike — Campagne automne",
    addedBy: "Sophie M.",
    date: "12 août",
    page: 3,
    excerpt:
      "Cible : 18-28 ans, contexte urbain quotidien. Thème : « Everyday Champion ». Visuels : sportifs amateurs, lumière naturelle, palette neutre + rouge Nike.",
  },
};

export const TEAM_BRAIN_ROLE_CONFIG = {
  admin: { label: "Admin", color: "#6b4b8b", desc: "Accès complet — voit et gère tous les projets et membres." },
  manager: { label: "Manager", color: "#0c6b52", desc: "Voit les projets de son équipe et peut ajouter des membres." },
  member: { label: "Membre", color: "#4b5d8b", desc: "Voit uniquement les projets auxquels il a été invité." },
} as const;
