import { LegalLink, LegalPage, LegalSection } from "@/components/LegalPage";

const CONTACT_EMAIL = "med.bouharras.15@gmail.com";

/** Conditions Générales d'Utilisation — page publique, accessible sans
 * connexion (voir /privacy-policy et /refund-policy, même principe). */
export default function TermsPage() {
  return (
    <LegalPage title="Conditions Générales d'Utilisation" lastUpdated="29 août 2026">
      <LegalSection title="1. Éditeur">
        <p>
          Distill est édité à titre personnel par Bouharras Mohamed, basé au Maroc. Contact : <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="2. Objet">
        <p>
          Distill est un service d&apos;aide à la révision par intelligence artificielle : à partir de texte, de
          photos de notes manuscrites ou de PDF de cours, Distill génère des résumés structurés, des flashcards et
          des questionnaires à choix multiples (QCM), ainsi qu&apos;un assistant de questions-réponses limité au
          contenu fourni (&laquo; Mode Explication &raquo;).
        </p>
      </LegalSection>

      <LegalSection title="3. Avertissement important — usage académique uniquement">
        <p>
          Distill est un outil d&apos;aide à la révision, pas une source médicale ou scientifique faisant autorité.
          Les contenus générés par l&apos;intelligence artificielle (résumés, flashcards, QCM, réponses du Mode
          Explication) peuvent contenir des erreurs, approximations ou omissions. Ils ne remplacent en aucun cas
          les cours, ouvrages de référence, ou l&apos;enseignement dispensé par ton établissement, et ne doivent
          jamais être utilisés comme source unique de révision pour des examens, ni interprétés comme un avis
          médical, un diagnostic, ou une recommandation clinique de quelque nature que ce soit. L&apos;utilisateur
          reste seul responsable de la vérification des informations et de son parcours académique.
        </p>
      </LegalSection>

      <LegalSection title="4. Compte utilisateur">
        <p>
          La création d&apos;un compte nécessite une adresse email valide. Chaque utilisateur est responsable de la
          confidentialité de ses identifiants et de l&apos;activité sur son compte.
        </p>
      </LegalSection>

      <LegalSection title="5. Abonnements et paiement">
        <p>
          Distill propose un essai gratuit (3 générations offertes, sans carte bancaire) puis 3 paliers
          d&apos;abonnement mensuel sans engagement (Essentiel, Étudiant, Intensif), ainsi qu&apos;une offre par
          équipe (Business Team, tarif dégressif par siège). Les paiements sont traités par Paddle.com, notre
          revendeur en ligne et prestataire de paiement (Merchant of Record) : Paddle gère la facturation, la
          collecte des paiements et le service client associé aux transactions. Les abonnements se renouvellent
          automatiquement chaque mois et peuvent être résiliés à tout moment depuis la page Abonnement, sans
          préavis ni pénalité — voir notre <LegalLink href="/refund-policy">Politique de remboursement</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="6. Propriété intellectuelle">
        <p>
          Les contenus que tu importes (notes, documents) restent ta propriété. Distill (marque, interface, code)
          est la propriété de son éditeur.
        </p>
      </LegalSection>

      <LegalSection title="7. Usage de l'intelligence artificielle">
        <p>
          Les contenus fournis (texte, images, PDF) sont transmis à l&apos;API commerciale d&apos;Anthropic
          (modèles Claude) dans le seul but de générer ta réponse, jamais à d&apos;autres fins ni partagés avec un
          tiers. Voir notre <LegalLink href="/privacy-policy">Politique de confidentialité</LegalLink> pour le
          détail.
        </p>
      </LegalSection>

      <LegalSection title="8. Résiliation">
        <p>
          Nous nous réservons le droit de suspendre ou résilier un compte en cas d&apos;usage abusif, frauduleux,
          ou de non-respect des présentes conditions.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation de responsabilité">
        <p>
          Distill est fourni &laquo; en l&apos;état &raquo;. Nous ne garantissons pas l&apos;exactitude,
          l&apos;exhaustivité ou la pertinence académique des contenus générés par l&apos;IA.
        </p>
      </LegalSection>

      <LegalSection title="10. Droit applicable">
        <p>Les présentes conditions sont soumises au droit français. Tout litige relève des tribunaux compétents.</p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
