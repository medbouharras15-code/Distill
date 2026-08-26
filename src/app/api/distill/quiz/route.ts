import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildFakeQuizResult, IS_SIMULATION_ENABLED } from "@/lib/aiSimulation";
import { logAiUsageEvent, usageCapResponse } from "@/lib/aiUsage";
import { getUserAndProfile } from "@/lib/auth";
import { FREE_GENERATIONS_LIMIT, isSubscribed } from "@/lib/billing";
import {
  SHARED_TASK_SYSTEM_PROMPT,
  anthropicErrorResponse,
  buildContentBlocks,
  callClaudeWithFallback,
  deletePdfBlob,
  extractJson,
  fetchPdfFromBlob,
  isQuizQuestion,
  missingApiKeyResponse,
  validateImageSize,
  withCacheControl,
} from "@/lib/distillServer";
import type { QuizDifficulty, QuizQuestion, QuizRequestBody } from "@/lib/types";

const QUIZ_QUESTION_COUNT = 12;

// Instructions propres au QCM — placées dans le message utilisateur (après
// le contenu source mis en cache) plutôt que dans le system prompt, qui
// reste volontairement générique et partagé avec /api/distill : voir
// SHARED_TASK_SYSTEM_PROMPT dans distillServer.ts.
function buildQuizInstructions(difficulty: QuizDifficulty): string {
  const difficultyInstruction =
    difficulty === "hard"
      ? "difficile : questions pointues, distracteurs plausibles et proches de la bonne réponse"
      : "facile : questions directes, distracteurs clairement différents de la bonne réponse";

  return `Génère un QCM de ${QUIZ_QUESTION_COUNT} questions à partir de ce contenu, niveau ${difficultyInstruction}, dans l'esprit d'un examen :
- Chaque question a un énoncé clair et 4 ou 5 propositions de réponse.
- Certaines questions ont UNE SEULE bonne réponse, d'autres en ont PLUSIEURS (2 ou plus) — mélange les deux types aléatoirement dans l'ordre des questions, sans jamais l'indiquer dans l'énoncé ni dans les propositions : l'étudiant doit le déduire par lui-même en lisant les choix, exactement comme dans un vrai examen.
- Vise un mélange équilibré entre questions à réponse unique et à réponses multiples (ni l'un ni l'autre en écrasante majorité).
- Pour chaque question, fournis une courte explication (1 à 2 phrases) justifiant la ou les bonnes réponses.
- Chaque proposition a un identifiant "id" à une seule lettre, unique au sein de sa question ("a", "b", "c", "d", éventuellement "e").
- Pour chaque question, indique aussi un thème court (2 à 4 mots, ex. "Cycle de Krebs", "Théorème de Pythagore") qui résume précisément la notion évaluée par cette question — utilisé pour repérer les points faibles récurrents de l'étudiant. Deux questions portant sur la même notion doivent recevoir exactement le même thème (même orthographe, mêmes mots) ; ne fusionne pas des notions différentes sous un thème trop large.
Format JSON attendu : {"quiz": [{"question": "...", "choices": [{"id": "a", "text": "..."}, {"id": "b", "text": "..."}], "correctChoiceIds": ["a"], "explanation": "...", "theme": "..."}]}`;
}

// Même contenu source que /api/distill (texte/photo/PDF) : peut prendre un
// certain temps pour 12 questions, même marge que la route principale.
export const maxDuration = 300;

/** Génère uniquement le QCM, dans un appel séparé de /api/distill — lancé
 * par le client une fois le résumé/les flashcards déjà affichés, pour ne
 * pas faire attendre l'utilisateur derrière les 12 questions. Le compteur
 * de générations gratuites n'est PAS incrémenté ici : /api/distill l'a déjà
 * fait pour l'ensemble de cette distillation (résumé + flashcards + QCM
 * compte pour une seule génération). On vérifie tout de même que le compte
 * n'est pas déjà au-delà de sa limite (`>`, pas `>=`) : dans le
 * déroulement normal, cet appel arrive juste après /api/distill qui vient
 * d'amener le compteur pile à la limite sur une dernière génération
 * gratuite légitime — `>=` rejetterait à tort ce cas. Un compte qui
 * dépasse déjà la limite (au-delà de ce que /api/distill autorise) reste
 * bloqué. */
export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return missingApiKeyResponse();
  }

  const auth = await getUserAndProfile();
  if (!auth) {
    return NextResponse.json({ error: "Vous devez être connecté pour générer un QCM." }, { status: 401 });
  }
  const { user, profile } = auth;
  const subscribed = isSubscribed(profile);

  if (!subscribed && profile.generations_used > FREE_GENERATIONS_LIMIT) {
    return NextResponse.json(
      {
        error: `Vous avez utilisé vos ${FREE_GENERATIONS_LIMIT} générations gratuites. Abonnez-vous pour continuer sans limite.`,
        limitReached: true,
      },
      { status: 403 },
    );
  }

  let body: QuizRequestBody;
  try {
    body = (await request.json()) as QuizRequestBody;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const text = body.text?.trim();
  const { image, pdf } = body;
  const difficulty = body.quizDifficulty === "easy" || body.quizDifficulty === "hard" ? body.quizDifficulty : null;

  if (!difficulty) {
    return NextResponse.json({ error: "Niveau de difficulté du QCM manquant ou invalide." }, { status: 400 });
  }

  if (!text && !image && !pdf) {
    return NextResponse.json(
      { error: "Merci de coller du texte, ou d'ajouter une image ou un PDF avant de générer un QCM." },
      { status: 400 },
    );
  }

  const fileError = validateImageSize(image);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  // Même logique que /api/distill : le PDF n'arrive que sous forme de
  // référence Vercel Blob, à télécharger/reconvertir en base64, puis
  // supprimer une fois l'appel terminé. Chaque appel (résumé/flashcards,
  // QCM, et chaque tentative de réessai du QCM) téléverse et supprime sa
  // propre copie — voir @/components/notes/AiPanel.
  let pdfFile: { data: string; mediaType: string } | undefined;
  try {
    let quiz: QuizQuestion[];

    if (IS_SIMULATION_ENABLED) {
      // Mode simulation (Preview uniquement, voir aiSimulation.ts) :
      // aucun appel réel à Claude, ni téléchargement du PDF — on renvoie
      // directement un QCM factice pour tester l'interface sans coût.
      quiz = await buildFakeQuizResult(QUIZ_QUESTION_COUNT);
    } else {
      if (subscribed) {
        const capResponse = await usageCapResponse(user.id);
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

      // Même contenu source que /api/distill, avec la même mise en cache
      // (voir withCacheControl) : si cet appel arrive dans les 5 minutes
      // suivant l'appel résumé (déroulement normal, voir
      // @/components/notes/AiPanel), il relit le PDF/photo/texte depuis le
      // cache Anthropic au lieu de le retraiter en entier — à condition que
      // le system prompt soit identique aux deux appels, d'où
      // SHARED_TASK_SYSTEM_PROMPT.
      const sourceContent = buildContentBlocks({ text, image, pdf: pdfFile }) as Anthropic.ContentBlockParam[];
      const content = [
        ...withCacheControl(sourceContent),
        { type: "text" as const, text: buildQuizInstructions(difficulty) },
      ];
      const client = new Anthropic({ apiKey });

      const response = await callClaudeWithFallback(client, {
        maxTokens: 8192,
        system: SHARED_TASK_SYSTEM_PROMPT,
        content,
      });

      // Diagnostic temporaire (même log que /api/distill/chat) pour vérifier
      // que cet appel relit bien le contenu source depuis le cache écrit par
      // /api/distill quelques secondes plus tôt. À retirer une fois la
      // vérification faite.
      console.log("[distill/quiz] usage Anthropic :", response.usage);

      // Suivi de consommation (Paramètres > IA Distill) — voir la même
      // logique dans /api/distill.
      await logAiUsageEvent({ userId: user.id, category: "generation", model: response.model, usage: response.usage });

      if (response.stop_reason === "refusal") {
        return NextResponse.json(
          { error: "Le modèle n'a pas pu générer de QCM pour ce contenu. Essayez avec un autre texte ou fichier." },
          { status: 422 },
        );
      }

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return NextResponse.json({ error: "Le modèle n'a renvoyé aucun contenu exploitable." }, { status: 502 });
      }

      const candidate = extractJson(textBlock.text) as { quiz?: unknown };
      if (!candidate || !Array.isArray(candidate.quiz) || !candidate.quiz.every(isQuizQuestion)) {
        return NextResponse.json(
          { error: "La réponse du modèle ne correspond pas au format de QCM attendu. Réessayez." },
          { status: 502 },
        );
      }
      quiz = candidate.quiz as QuizQuestion[];
    }

    return NextResponse.json({ quiz });
  } catch (error) {
    return anthropicErrorResponse(error);
  } finally {
    if (pdf) {
      await deletePdfBlob(pdf.url);
    }
  }
}
