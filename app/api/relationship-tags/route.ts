import { NextRequest, NextResponse } from "next/server";
import {
  isStandardRelationshipTag,
  normalizeRelationshipTag,
  normalizeRelationshipTags,
} from "@/lib/relationship-tags";
import { createSupabaseServerClient } from "@/lib/supabase-server";

async function getAuthedSupabase() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { supabase, userId: session?.user.id ?? null };
}

function labelFromBody(value: unknown) {
  if (typeof value !== "string") return null;
  const label = value.trim().replace(/\s+/g, " ");
  if (!label || label.length > 39) return null;
  const tagKey = normalizeRelationshipTag(label);
  if (!tagKey || isStandardRelationshipTag(tagKey)) return null;
  return { label, tagKey };
}

export async function GET() {
  const { supabase, userId } = await getAuthedSupabase();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("relationship_tag_definitions")
    .select("id, tag_key, label")
    .eq("user_id", userId)
    .order("label");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tags: data || [] });
}

export async function POST(req: NextRequest) {
  const { supabase, userId } = await getAuthedSupabase();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = labelFromBody((await req.json() as { label?: unknown }).label);
  if (!parsed) {
    return NextResponse.json({ error: "Use a unique tag name with letters, numbers, spaces, hyphens, or underscores." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("relationship_tag_definitions")
    .insert({ user_id: userId, tag_key: parsed.tagKey, label: parsed.label })
    .select("id, tag_key, label")
    .single();

  if (error?.code === "23505") {
    return NextResponse.json({ error: "You already have a custom tag with that name." }, { status: 409 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tag: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { supabase, userId } = await getAuthedSupabase();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as { id?: string; label?: unknown };
  const id = body.id?.trim();
  const parsed = labelFromBody(body.label);
  if (!id || !parsed) return NextResponse.json({ error: "A valid tag and label are required." }, { status: 400 });

  const { data: definition } = await supabase
    .from("relationship_tag_definitions")
    .select("id, tag_key, label")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!definition) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (definition.tag_key !== parsed.tagKey) {
    const { data: collision } = await supabase
      .from("relationship_tag_definitions")
      .select("id")
      .eq("user_id", userId)
      .eq("tag_key", parsed.tagKey)
      .maybeSingle();
    if (collision) return NextResponse.json({ error: "You already have a custom tag with that name." }, { status: 409 });

    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id, relationship_tags, primary_relationship_tag")
      .eq("user_id", userId)
      .contains("relationship_tags", [definition.tag_key]);
    if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 500 });

    for (const contact of contacts || []) {
      const tags = normalizeRelationshipTags((contact.relationship_tags || []).map((tag: string) => tag === definition.tag_key ? parsed.tagKey : tag));
      const primary = contact.primary_relationship_tag === definition.tag_key
        ? parsed.tagKey
        : tags.includes(contact.primary_relationship_tag) ? contact.primary_relationship_tag : tags[0] || null;
      const { error: updateContactError } = await supabase
        .from("contacts")
        .update({ relationship_tags: tags, primary_relationship_tag: primary })
        .eq("id", contact.id)
        .eq("user_id", userId);
      if (updateContactError) return NextResponse.json({ error: updateContactError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("relationship_tag_definitions")
    .update({ tag_key: parsed.tagKey, label: parsed.label })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, tag_key, label")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tag: data });
}

export async function DELETE(req: NextRequest) {
  const { supabase, userId } = await getAuthedSupabase();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: definition } = await supabase
    .from("relationship_tag_definitions")
    .select("id, tag_key")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!definition) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("id, relationship_tags, primary_relationship_tag")
    .eq("user_id", userId)
    .contains("relationship_tags", [definition.tag_key]);
  if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 500 });

  for (const contact of contacts || []) {
    const tags = normalizeRelationshipTags((contact.relationship_tags || []).filter((tag: string) => tag !== definition.tag_key));
    const primary = tags.includes(contact.primary_relationship_tag)
      ? contact.primary_relationship_tag
      : tags[0] || null;
    const { error: updateContactError } = await supabase
      .from("contacts")
      .update({ relationship_tags: tags, primary_relationship_tag: primary })
      .eq("id", contact.id)
      .eq("user_id", userId);
    if (updateContactError) return NextResponse.json({ error: updateContactError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("relationship_tag_definitions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
