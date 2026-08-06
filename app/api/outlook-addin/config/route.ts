import { NextResponse } from "next/server";
import { getMicrosoftClientId } from "@/lib/microsoft-oauth";

export const dynamic = "force-dynamic";

// Client IDs are public identifiers. Keeping this server-side avoids a second
// deployment setting while ensuring the pane and existing OAuth connection use
// the same Entra application registration.
export async function GET() {
  const clientId = getMicrosoftClientId();
  return NextResponse.json({ clientId: clientId || null });
}
