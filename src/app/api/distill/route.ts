import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildFakeDistillResult, IS_SIMULATION_ENABLED } from "@/lib/aiSimulation";
import { logAiUsageEvent, usageCapResponse } from "@/lib/aiUsage";
import { getUserAndProfile } from "@/lib/auth";
import { FREE_GENERATIONS_LIMIT, getTier, isSubscribed } from "@/lib/billing";
import {
  SHARED_TASK_SYSTEM_PROMPT,
  anthropicErrorResponse,
  buildContentBlocks,
  callClaudeWithFallback,
  deletePdfBlob,
  extractJson,
  fetchPdfFromBlob,
  missingApiKeyResponse,
  validateImageSize,
  withCacheControl,
} from "@/lib/distillServer";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DistillRequestBody, DistillResult } from "@/lib/types";

// Instructions propres au résumé — placées dans le message utilisateur
// (après le contenu source mis en cache) plutôt que dans le system prompt,
// qui reste volontairement générique et partagé avec /api/distill/quiz :
// voir SHARED_TASK_SYSTEM_PROMPT dans distillServer.ts. Le QCM est généré
// séparément par /api/distill/quiz (appel indépendant, lancé une fois ce
// résumé affiché) : cette route n'en a plus la charge, ce qui garde le
// premier affichage rapide comme avant l'introduction du QCM.
const RESUME_INSTRUCTIONS = `Génère un résumé et 8 à 10 flashcards (question/réponse) à partir de ce contenu.
- "summary" doit être une SEULE chaîne de texte au format Markdown (jamais un objet JSON imbriqué, même si le contenu source est lui-même très structuré en de nombreuses sections) : utilise des titres Markdown (## Titre de section), des puces (- point) et du gras (**terme important**) directement à l'intérieur de cette chaîne pour restituer la structure.
Format JSON attendu : {"summary": "## Titre\\n\\nTexte...\\n\\n## Autre section\\n- point 1\\n- point 2", "flashcards": [{"question": "...", "answer": "..."}]}`;

// Depuis le passage des PDF à Vercel Blob, cette route peut recevoir des
// documents nettement plus lourds (jusqu'à 15 Mo) qu'auparavant — Claude met
// alors plus de temps à les analyser. 60s suffisait tant que les PDF étaient
// plafonnés à ~3,1 Mo, mais provoquait un 504 sur de plus gros documents.
// Alignée sur la même marge que /api/distill/quiz.
export const maxDuration = 300;

interface DistillCandidate {
  summary: string | Record<string, unknown>;
  flashcards: { question: string; answer: string }[];
}

/** Accepte "summary" sous forme de chaîne (format demandé, voir
 * RESUME_INSTRUCTIONS) OU d'objet JSON imbriqué (titre/sections/points…) —
 * malgré l'instruction explicite, le modèle a tendance à structurer le
 * résumé en JSON plutôt qu'en Markdown plat quand le contenu source est
 * lui-même très sectionné (ex. un cours avec de nombreux titres). Rejeter la
 * distillation entière pour ce simple écart de présentation serait trop
 * strict — voir flattenSummaryValue, qui l'aplatit en Markdown ci-dessous. */
function isDistillCandidate(value: unknown): value is DistillCandidate {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;

  const summaryOk =
    typeof v.summary === "string" ||
    (v.summary !== null && typeof v.summary === "object" && !Array.isArray(v.summary));
  if (!summaryOk) return false;

  if (!Array.isArray(v.flashcards)) return false;
  return v.flashcards.every((card) => {
    if (!card || typeof card !== "object") return false;
    const c = card as Record<string, unknown>;
    return typeof c.question === "string" && typeof c.answer === "string";
  });
}

/** Aplatit récursivement un résumé structuré en JSON (voir isDistillCandidate
 * ci-dessus) en une seule chaîne Markdown affichable par SummaryView
 * (@/components/notes/AiPanel, rendu via ReactMarkdown) : un objet avec un
 * champ title/titre devient un titre de section, un tableau devient une
 * liste à puces, tout le reste est concaténé en paragraphes. `depth`
 * n'augmente qu'aux niveaux qui produisent réellement un titre (un objet
 * sans title/titre, ex. un simple dictionnaire de sous-sections, ne compte
 * pas comme un niveau à part entière) pour que la hiérarchie de titres reste
 * cohérente même à travers un niveau d'imbrication purement technique. */
function flattenSummaryValue(value: unknown, depth = 2): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? `- ${item}` : flattenSummaryValue(item, depth)))
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const titleEntry = entries.find(([key]) => key.toLowerCase() === "title" || key.toLowerCase() === "titre");
    const heading = titleEntry ? String(titleEntry[1]) : null;
    const nextDepth = heading ? depth + 1 : depth;
    const body = entries
      .filter(([key]) => key !== titleEntry?.[0])
      .map(([, v]) => flattenSummaryValue(v, nextDepth))
      .filter(Boolean)
      .join("\n\n");
    return heading ? `${"#".repeat(Math.min(depth, 6))} ${heading}\n\n${body}` : body;
  }

  return "";
}

function normalizeDistillSummary(summary: string | Record<string, unknown>): string {
  return typeof summary === "string" ? summary.trim() : flattenSummaryValue(summary).trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return missingApiKeyResponse();
  }

  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json(
      { error: "Vous devez être connecté pour distiller vos notes." },
      { status: 401 },
    );
  }
  const { user, profile } = auth;
  const subscribed = isSubscribed(profile);

  if (!subscribed && profile.generations_used >= FREE_GENERATIONS_LIMIT) {
    return NextResponse.json(
      {
        error: `Vous avez utilisé vos ${FREE_GENERATIONS_LIMIT} générations gratuites. Abonnez-vous pour continuer sans limite.`,
        limitReached: true,
      },
      { status: 403 },
    );
  }

  let body: DistillRequestBody;
  try {
    body = (await request.json()) as DistillRequestBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const text = body.text?.trim();
  const { image, pdf } = body;

  if (!text && !image && !pdf) {
    return NextResponse.json(
      {
        error:
          "Merci de coller du texte, ou d'ajouter une image ou un PDF avant de distiller vos notes.",
      },
      { status: 400 },
    );
  }

  const fileError = validateImageSize(image);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  // Le PDF n'arrive plus que sous forme de référence Vercel Blob (voir
  // @/app/api/upload/pdf) : on le télécharge et le reconvertit en base64
  // pour que buildContentBlocks reste inchangée, puis on supprime la copie
  // temporaire sur Blob une fois l'appel à Claude terminé — succès ou échec.
  let pdfFile: { data: string; mediaType: string } | undefined;
  try {
    let parsed: DistillResult;

    if (IS_SIMULATION_ENABLED) {
      // Mode simulation (Preview uniquement, voir aiSimulation.ts) :
      // aucun appel réel à Claude, ni téléchargement du PDF — on renvoie
      // directement un résultat factice pour tester l'interface sans coût.
      parsed = await buildFakeDistillResult();
    } else {
      const tier = getTier(profile);
      if (tier) {
        const capResponse = await usageCapResponse(user.id, tier);
        if (capResponse) return capResponse;
      }

      if (pdf) {
        try {
          const { data } = await fetchPdfFromBlob(pdf.url);
          pdfFile = { data, mediaType: "application/pdf" };
        } catch (error) {
          return NextResponse.json(
            { error: error instanceof Error ? error.message : "Impossible de récupérer le PDF téléversé." },
            { status: 400 },
          );
        }
      }

      // Le contenu source est mis en cache (voir withCacheControl) : le même
      // PDF/photo/texte est renvoyé quelques secondes plus tard, à l'identique,
      // par /api/distill/quiz pour générer le QCM — ce dernier peut alors le
      // relire depuis le cache Anthropic au lieu de le retraiter en entier.
      const sourceContent = buildContentBlocks({ text, image, pdf: pdfFile }) as Anthropic.ContentBlockParam[];
      const content = [...withCacheControl(sourceContent), { type: "text" as const, text: RESUME_INSTRUCTIONS }];
      const client = new Anthropic({ apiKey });

      // 6000 s'est révélé encore insuffisant en pratique sur un contenu
      // dense (voir le garde-fou stop_reason === "max_tokens" ci-dessous,
      // qui a permis de le constater clairement au lieu d'un échec confus).
      // Une marge nettement plus large évite d'avoir à réajuster ce chiffre
      // à chaque nouveau PDF plus dense — un dépassement du vrai plafond
      // du modèle remonterait de toute façon une erreur API explicite,
      // jamais une troncature silencieuse.
      const response = await callClaudeWithFallback(client, {
        maxTokens: 16000,
        system: SHARED_TASK_SYSTEM_PROMPT,
        content,
      });

      // Diagnostic temporaire (même log que /api/distill/chat) pour vérifier
      // que /api/distill/quiz relit bien ce contenu source depuis le cache
      // quelques secondes plus tard. À retirer une fois la vérification faite.
      console.log("[distill] usage Anthropic :", response.usage);

      // Suivi de consommation (Paramètres > IA Distill) — response.model
      // reflète le modèle qui a réellement répondu (Haiku ou Sonnet selon
      // repli). N'échoue jamais la requête si l'écriture échoue.
      await logAiUsageEvent({ userId: user.id, category: "generation", model: response.model, usage: response.usage });

      if (response.stop_reason === "refusal") {
        return NextResponse.json(
          {
            error:
              "Le modèle n'a pas pu traiter ce contenu. Essayez avec un autre texte ou fichier.",
          },
          { status: 422 },
        );
      }

      // Une réponse tronquée par la limite de tokens ne peut jamais former un
      // JSON valide (coupée en plein milieu) — mieux vaut le dire clairement
      // que de laisser extractJson échouer plus bas avec une erreur générique
      // (même vérification que /api/distill/chat et /api/distill/quiz).
      if (response.stop_reason === "max_tokens") {
        console.error("[distill] Réponse coupée par la limite de tokens :", {
          outputTokens: response.usage.output_tokens,
        });
        return NextResponse.json(
          {
            error:
              "Le résumé était trop long pour être généré entièrement et a été coupé. Réessayez — si le problème persiste, essayez avec un contenu plus court.",
          },
          { status: 502 },
        );
      }

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return NextResponse.json(
          { error: "Le modèle n'a renvoyé aucun contenu exploitable." },
          { status: 502 },
        );
      }

      // Journalise systématiquement la réponse brute en cas d'échec de
      // parsing ou de validation — jusqu'ici rien n'était loggé dans ces deux
      // cas, rendant tout diagnostic impossible même avec accès aux logs
      // Vercel (même correctif que /api/distill/quiz). Aperçu borné à 6000
      // caractères pour rester lisible dans les logs.
      let candidate: unknown;
      try {
        candidate = extractJson(textBlock.text);
      } catch (parseError) {
        console.error("[distill] JSON illisible dans la réponse du modèle :", {
          stopReason: response.stop_reason,
          outputTokens: response.usage.output_tokens,
          error: parseError instanceof Error ? parseError.message : parseError,
          rawTextPreview: textBlock.text.slice(0, 6000),
        });
        return NextResponse.json(
          { error: "La réponse du modèle ne correspond pas au format attendu. Réessayez." },
          { status: 502 },
        );
      }

      if (!isDistillCandidate(candidate)) {
        console.error("[distill] Résultat structurellement invalide :", {
          stopReason: response.stop_reason,
          outputTokens: response.usage.output_tokens,
          rawTextPreview: textBlock.text.slice(0, 6000),
        });
        return NextResponse.json(
          {
            error:
              "La réponse du modèle ne correspond pas au format attendu. Réessayez.",
          },
          { status: 502 },
        );
      }
      parsed = { summary: normalizeDistillSummary(candidate.summary), flashcards: candidate.flashcards };
    }

    // Ne compte que pour les comptes non abonnés — un abonné actif n'a pas
    // de limite. L'écriture passe par le client "service role" car les
    // utilisateurs n'ont pas le droit de modifier leur propre compteur.
    // Cet unique incrément couvre tout le résultat (résumé + flashcards +,
    // le cas échéant, le QCM généré séparément juste après par le client) :
    // /api/distill/quiz n'incrémente jamais ce compteur lui-même.
    if (!subscribed) {
      const admin = createAdminClient();
      await admin
        .from("profiles")
        .update({ generations_used: profile.generations_used + 1 })
        .eq("id", user.id);
    }

    return NextResponse.json(parsed satisfies DistillResult);
  } catch (error) {
    return anthropicErrorResponse(error);
  } finally {
    if (pdf) {
      await deletePdfBlob(pdf.url);
    }
  }
}
