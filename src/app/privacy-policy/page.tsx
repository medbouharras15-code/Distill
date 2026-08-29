import { LegalLink, LegalPage, LegalSection } from "@/components/LegalPage";

const CONTACT_EMAIL = "med.bouharras.15@gmail.com";

/** Politique de confidentialité — page publique, accessible sans connexion
 * (voir /terms et /refund-policy, même principe). */
export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Politique de confidentialité" lastUpdated="29 août 2026">
      <LegalSection title="1. Responsable du traitement">
        <p>
          Distill est édité à titre personnel par Bouharras Mohamed, basé au Maroc. Contact : <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <ul className="list-disc space-y-2 pl-5">
          <li>Données de compte : adresse email, mot de passe (chiffré).</li>
          <li>
            Contenu que tu soumets : texte, photos, PDF envoyés pour génération — traités le temps de la requête,
            jamais stockés durablement (les PDF sont supprimés automatiquement après traitement ; les photos ne
            sont jamais enregistrées sous forme de fichier).
          </li>
          <li>
            Données d&apos;usage : nombre de générations, consommation de jetons, statistiques de révision (QCM,
            thèmes maîtrisés/à revoir).
          </li>
          <li>
            Données de paiement : gérées intégralement par Paddle (voir ci-dessous) — nous ne recevons ni ne
            stockons jamais de numéro de carte bancaire.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalités">
        <p>
          Fournir le service (génération IA, suivi de progression), gérer les abonnements, assurer la sécurité du
          compte, répondre aux demandes de support.
        </p>
      </LegalSection>

      <LegalSection title="4. Destinataires des données">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Anthropic</strong> (modèles Claude) : reçoit le contenu soumis
            pour générer les réponses. Par défaut, Anthropic n&apos;utilise pas les données transmises via son API
            commerciale pour entraîner ses modèles. Anthropic étant basé aux États-Unis, ce transfert hors UE est
            encadré par les clauses contractuelles types (Standard Contractual Clauses).
          </li>
          <li>
            <strong className="text-foreground">Paddle.com</strong> : notre prestataire de paiement (Merchant of
            Record) — traite les données nécessaires à la facturation et à la gestion des abonnements.
          </li>
          <li>
            <strong className="text-foreground">Supabase</strong> : hébergement de notre base de données et
            authentification.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Durée de conservation">
        <p>
          Les données de compte sont conservées tant que le compte est actif. Les documents soumis (PDF, photos)
          ne sont jamais conservés au-delà du traitement immédiat de la requête.
        </p>
      </LegalSection>

      <LegalSection title="6. Tes droits (RGPD)">
        <p>
          Conformément au RGPD, tu disposes d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          portabilité et d&apos;opposition sur tes données. Pour l&apos;exercer, écris à{" "}
          <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink> — la suppression de compte en un
          clic est en cours de développement, en attendant nous traitons chaque demande manuellement.
        </p>
      </LegalSection>

      <LegalSection title="7. Sécurité">
        <p>
          Les mots de passe sont chiffrés, les communications passent par HTTPS, l&apos;accès à la base de données
          est protégé par des règles de sécurité au niveau des lignes (Row Level Security).
        </p>
      </LegalSection>

      <LegalSection title="8. Cookies">
        <p>
          Distill utilise uniquement des cookies strictement nécessaires au fonctionnement du service (session
          d&apos;authentification) — aucun cookie publicitaire ou de tracking tiers.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact">
        <p>
          Pour toute question relative à tes données : <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
