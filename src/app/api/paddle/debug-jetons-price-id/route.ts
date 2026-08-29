import { NextResponse } from "next/server";
import { JETONS_PACK_PRICE_ID } from "@/lib/paddle";

/** TEMPORAIRE — inspecte la valeur exacte de JETONS_PACK_PRICE_ID (dérivée
 * de NEXT_PUBLIC_PADDLE_PRICE_ID_JETONS) telle que lue par le serveur, pour
 * diagnostiquer pourquoi le webhook transaction.completed (200, livré) ne
 * crédite jamais purchased_jetons_balance — voir isJetonsPriceId dans
 * @/lib/paddle, qui ignore silencieusement tout Price ID qui ne correspond
 * pas exactement à cette valeur. Pas un secret (Price ID Paddle), affiché
 * en entier. À SUPPRIMER une fois le diagnostic terminé. */
export async function GET() {
  return NextResponse.json({
    value: JETONS_PACK_PRICE_ID,
    length: JETONS_PACK_PRICE_ID.length,
    isEmpty: JETONS_PACK_PRICE_ID.length === 0,
  });
}
