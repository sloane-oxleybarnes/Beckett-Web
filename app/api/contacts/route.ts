import { NextRequest, NextResponse } from "next/server";
import {
  buildContactIdentifierRows,
  ContactIdentifierInput,
} from "@/lib/contact-identifiers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getRequestUserId } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  const userId = await getRequestUserId(req, { allowExtension: true });
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*, contact_identifiers(*), contact_insights(*), contact_relationship_summaries(*)")
    .eq("user_id", userId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data });
}

export async function POST(req: NextRequest) {
  const userId = await getRequestUserId(req, { allowExtension: true });
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name: string;
    email?: string | null;
    slack_handle?: string | null;
    phone_number?: string | null;
    relationship_type?: string | null;
    relationship_other?: string | null;
    notes?: string | null;
    trusted?: boolean;
    identifiers?: ContactIdentifierInput[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name: body.name.trim(),
      email: body.email?.toLowerCase().trim() || null,
      slack_handle: body.slack_handle?.trim() || null,
      phone_number: body.phone_number?.trim() || null,
      relationship_type: body.relationship_type?.trim() || null,
      relationship_other: body.relationship_other?.trim() || null,
      notes: body.notes?.trim() || null,
      trusted: body.trusted ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const identifiers = buildContactIdentifierRows({
    contactId: contact.id,
    userId,
    email: body.email,
    slackHandle: body.slack_handle,
    phoneNumber: body.phone_number,
    identifiers: body.identifiers,
  });

  if (identifiers.length > 0) {
    const { error: identifiersError } = await supabase
      .from("contact_identifiers")
      .upsert(identifiers, { onConflict: "user_id,platform,identifier" });

    if (identifiersError) return NextResponse.json({ error: identifiersError.message }, { status: 500 });
  }

  return NextResponse.json({ contact }, { status: 201 });
}
