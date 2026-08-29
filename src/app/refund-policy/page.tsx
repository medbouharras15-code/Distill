import { LegalLink, LegalPage, LegalSection } from "@/components/LegalPage";

const CONTACT_EMAIL = "med.bouharras.15@gmail.com";

/** Politique de remboursement — page publique, accessible sans connexion
 * (voir /terms et /privacy-policy, même principe). */
export default function RefundPolicyPage() {
  return (
    <LegalPage title="Politique de remboursement" lastUpdated="29 août 2026">
      <LegalSection title="1. Abonnements sans engagement">
        <p>
          Tous les abonnements Distill (paliers individuels et Business Team) sont mensuels et sans engagement. Tu
          peux annuler à tout moment depuis la page Abonnement — l&apos;annulation prend effet immédiatement,
          aucun prélèvement ultérieur n&apos;aura lieu.
        </p>
      </LegalSection>

      <LegalSection title="2. Droit de rétractation (clients particuliers, UE)">
        <p>
          Conformément au droit européen de la consommation, tu disposes d&apos;un délai de rétractation de 14
          jours à compter de ton premier abonnement pour demander un remboursement intégral, sauf si tu as
          explicitement demandé et accepté l&apos;accès immédiat au service (ce que confirme le paiement via
          l&apos;interface Paddle), auquel cas ce droit peut être perdu une fois le service pleinement fourni.
          Pour toute demande, écris à <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="3. Pas de remboursement au prorata">
        <p>
          En dehors du délai de rétractation ci-dessus, une résiliation en cours de mois ne donne pas lieu à un
          remboursement au prorata de la période déjà entamée — l&apos;accès reste actif jusqu&apos;à la fin de la
          période déjà payée.
        </p>
      </LegalSection>

      <LegalSection title="4. Paiements traités par Paddle">
        <p>
          L&apos;ensemble des paiements et remboursements sont traités par Paddle.com, notre revendeur en ligne
          (Merchant of Record). Toute demande de remboursement peut aussi être adressée directement au support
          Paddle, accessible depuis l&apos;email de confirmation de paiement.
        </p>
      </LegalSection>

      <LegalSection title="5. Cas exceptionnels">
        <p>
          En cas de dysfonctionnement avéré du service ayant empêché son utilisation normale, contacte-nous à{" "}
          <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink> — nous étudions chaque situation
          au cas par cas.
        </p>
      </LegalSection>

      <LegalSection title="6. Contact">
        <p>
          <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
