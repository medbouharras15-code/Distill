import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getUserAndProfile } from "@/lib/auth";
import { FREE_GENERATIONS_LIMIT, isSubscribed } from "@/lib/billing";
import {
  MODEL,
  anthropicErrorResponse,
  buildContentBlocks,
  extractJson,
  isQuizQuestion,
  missingApiKeyResponse,
  validateFileSizes,
} from "@/lib/distillServer";
import type { QuizDifficulty, QuizQuestion, QuizRequestBody } from "@/lib/types";

const QUIZ_QUESTION_COUNT = 20;

function buildQuizSystemPrompt(difficulty: QuizDifficulty): string {
  const difficultyInstruction =
    difficulty === "hard"
      ? "difficile : questions pointues, distracteurs plausibles et proches de la bonne réponse"
      : "facile : questions directes, distracteurs clairement différents de la bonne réponse";

  return `Tu es un expert pédagogique. Génère un QCM de ${QUIZ_QUESTION_COUNT} questions à partir de ce contenu, niveau ${difficultyInstruction}, dans l'esprit d'un examen :
- Chaque question a un énoncé clair et 4 ou 5 propositions de réponse.
- Certaines questions ont UNE SEULE bonne réponse, d'autres en ont PLUSIEURS (2 ou plus) — mélange les deux types aléatoirement dans l'ordre des questions, sans jamais l'indiquer dans l'énoncé ni dans les propositions : l'étudiant doit le déduire par lui-même en lisant les choix, exactement comme dans un vrai examen.
- Vise un mélange équilibré entre questions à réponse unique et à réponses multiples (ni l'un ni l'autre en écrasante majorité).
- Pour chaque question, fournis une courte explication (1 à 2 phrases) justifiant la ou les bonnes réponses.
- Chaque proposition a un identifiant "id" à une seule lettre, unique au sein de sa question ("a", "b", "c", "d", éventuellement "e").
Réponds uniquement en JSON : {"quiz": [{"question": "...", "choices": [{"id": "a", "text": "..."}, {"id": "b", "text": "..."}], "correctChoiceIds": ["a"], "explanation": "..."}]}`;
}

// Même contenu source que /api/distill (texte/photo/PDF) : peut prendre un
// certain temps pour 20 questions, même marge que la route principale.
export const maxDuration = 300;

/** Génère uniquement le QCM, dans un appel séparé de /api/distill — lancé
 * par le client une fois le résumé/les flashcards déjà affichés, pour ne
 * pas faire attendre l'utilisateur derrière les 20 questions. Le compteur
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
  const { profile } = auth;
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

  const fileError = validateFileSizes([image, pdf]);
  if (fileError) {
    return NextResponse.json({ error: fileError }, { status: 400 });
  }

  const content = buildContentBlocks({ text, image, pdf });
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: buildQuizSystemPrompt(difficulty),
      messages: [{ role: "user", content }],
    });

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

    const parsed = extractJson(textBlock.text) as { quiz?: unknown };
    if (!parsed || !Array.isArray(parsed.quiz) || !parsed.quiz.every(isQuizQuestion)) {
      return NextResponse.json(
        { error: "La réponse du modèle ne correspond pas au format de QCM attendu. Réessayez." },
        { status: 502 },
      );
    }

    return NextResponse.json({ quiz: parsed.quiz as QuizQuestion[] });
  } catch (error) {
    return anthropicErrorResponse(error);
  }
}
