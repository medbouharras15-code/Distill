import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Statut 303 explicite : un redirect par défaut (307) préserve la méthode
  // d'origine, donc le navigateur ré-émettrait ce POST vers /login (une
  // page qui n'a pas de handler POST) — d'où une page blanche jusqu'au
  // rafraîchissement manuel. 303 force toujours un GET sur la requête
  // suivante, quelle que soit la méthode d'origine.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
