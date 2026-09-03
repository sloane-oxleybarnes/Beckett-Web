"use client";

import { useEffect, useState, useCallback } from "react";
import {
  additionalIdentifierOptions,
  contactRelationshipLabel as relationshipLabel,
  emptyContactForm as emptyForm,
  identifierLabel,
  isLegacyIdentifier,
  type Contact,
  type ContactIdentifier,
  type ContactInsights,
  type RelationshipSummary,
} from "@/features/contacts/contact-model";
import { createRelationshipTag, fetchContacts, fetchRelationshipTags } from "@/features/contacts/contact-api";
import { useContactDirectory } from "@/features/contacts/use-contact-directory";
import {
  primaryRelationshipTagForContact,
  relationshipTagLabel,
  relationshipTagsForContact,
  type RelationshipTagDefinition,
} from "@/lib/relationship-tags";

export default function ContactsClient() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeError, setMergeError] = useState("");
  const [merging, setMerging] = useState(false);
  const [customRelationshipTag, setCustomRelationshipTag] = useState("");
  const [customTags, setCustomTags] = useState<RelationshipTagDefinition[]>([]);
  const [tagError, setTagError] = useState("");
  const [editingTagLabels, setEditingTagLabels] = useState<Record<string, string>>({});

  const loadContacts = useCallback(async () => {
    try {
      setContacts(await fetchContacts());
    } catch {
      setLoading(false);
      return;
    }
    setLoading(false);
  }, []);

  const loadCustomTags = useCallback(async () => {
    const tags = await fetchRelationshipTags().catch(() => []);
    setCustomTags(tags);
    setEditingTagLabels(Object.fromEntries(tags.map((tag) => [tag.id, tag.label])));
  }, []);

  useEffect(() => { void Promise.all([loadContacts(), loadCustomTags()]); }, [loadContacts, loadCustomTags]);

  const { availableRelationshipTags, filtered, selectedContact, selectedRelationshipSummary } = useContactDirectory({ contacts, customTags, search, relationshipFilter, selectedId });

  function openAdd() {
    setForm(emptyForm());
    setEditingId(null);
    setCustomRelationshipTag("");
    setShowForm(true);
    setSelectedId(null);
  }

  function openEdit(c: Contact) {
    setForm({
      name: c.name,
      email: c.email || "",
      slack_handle: c.slack_handle || "",
      phone_number: c.phone_number || "",
      identifiers: (c.contact_identifiers || [])
        .filter((identifier) => !isLegacyIdentifier(identifier))
        .map((identifier) => ({
          platform: identifier.platform,
          identifier: identifier.identifier,
          label: identifier.label,
          confirmed: identifier.confirmed,
        })),
      relationship_tags: relationshipTagsForContact(c),
      primary_relationship_tag: primaryRelationshipTagForContact(c) || "",
      notes: c.notes || "",
      trusted: c.trusted,
    });
    setEditingId(c.id);
    setCustomRelationshipTag("");
    setShowForm(true);
    setSelectedId(null);
  }

  function addIdentifier() {
    setForm((current) => ({
      ...current,
      identifiers: [
        ...current.identifiers,
        { platform: "work_email", identifier: "", label: null, confirmed: true },
      ],
    }));
  }

  function toggleRelationshipTag(tag: string) {
    setForm((current) => {
      const selected = current.relationship_tags.includes(tag);
      const relationshipTags = selected
        ? current.relationship_tags.filter((currentTag) => currentTag !== tag)
        : [...current.relationship_tags, tag];
      return {
        ...current,
        relationship_tags: relationshipTags,
        primary_relationship_tag: selected && current.primary_relationship_tag === tag
          ? relationshipTags[0] || ""
          : current.primary_relationship_tag || tag,
      };
    });
  }

  async function addCustomRelationshipTag() {
    if (!customRelationshipTag.trim()) return;
    setTagError("");
    const data = await createRelationshipTag(customRelationshipTag).catch((error: unknown) => ({ error: error instanceof Error ? error.message : "Could not add that custom tag." }));
    if (!("tag" in data) || !data.tag) {
      setTagError("error" in data ? data.error : "Could not add that custom tag.");
      return;
    }
    setCustomTags((current) => [...current, data.tag!].sort((a, b) => a.label.localeCompare(b.label)));
    setEditingTagLabels((current) => ({ ...current, [data.tag!.id]: data.tag!.label }));
    setForm((current) => current.relationship_tags.includes(data.tag!.tag_key)
      ? current
      : {
          ...current,
          relationship_tags: [...current.relationship_tags, data.tag!.tag_key],
          primary_relationship_tag: current.primary_relationship_tag || data.tag!.tag_key,
        });
    setCustomRelationshipTag("");
  }

  async function renameCustomRelationshipTag(tag: RelationshipTagDefinition) {
    const label = (editingTagLabels[tag.id] || "").trim();
    if (!label || label === tag.label) return;
    setTagError("");
    const res = await fetch("/api/relationship-tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id, label }),
    });
    const data = await res.json() as { tag?: RelationshipTagDefinition; error?: string };
    if (!res.ok || !data.tag) {
      setTagError(data.error || "Could not rename that custom tag.");
      return;
    }
    setForm((current) => ({
      ...current,
      relationship_tags: current.relationship_tags.map((item) => item === tag.tag_key ? data.tag!.tag_key : item),
      primary_relationship_tag: current.primary_relationship_tag === tag.tag_key ? data.tag!.tag_key : current.primary_relationship_tag,
    }));
    await Promise.all([loadCustomTags(), loadContacts()]);
  }

  async function deleteCustomRelationshipTag(tag: RelationshipTagDefinition) {
    if (!window.confirm(`Remove the custom tag “${tag.label}” from your tag list and every contact using it?`)) return;
    setTagError("");
    const res = await fetch(`/api/relationship-tags?id=${encodeURIComponent(tag.id)}`, { method: "DELETE" });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      setTagError(data.error || "Could not remove that custom tag.");
      return;
    }
    setForm((current) => {
      const relationshipTags = current.relationship_tags.filter((item) => item !== tag.tag_key);
      return {
        ...current,
        relationship_tags: relationshipTags,
        primary_relationship_tag: current.primary_relationship_tag === tag.tag_key
          ? relationshipTags[0] || ""
          : current.primary_relationship_tag,
      };
    });
    await Promise.all([loadCustomTags(), loadContacts()]);
  }

  function updateIdentifier(index: number, patch: Partial<ContactIdentifier>) {
    setForm((current) => ({
      ...current,
      identifiers: current.identifiers.map((identifier, i) =>
        i === index
          ? {
              ...identifier,
              ...patch,
              confirmed: patch.platform === "slack_user_id" ? true : patch.confirmed ?? identifier.confirmed ?? true,
            }
          : identifier
      ),
    }));
  }

  function removeIdentifier(index: number) {
    setForm((current) => ({
      ...current,
      identifiers: current.identifiers.filter((_, i) => i !== index),
    }));
  }

  function openMerge(c: Contact) {
    const firstOtherContact = contacts.find((contact) => contact.id !== c.id);
    setMergeSourceId(c.id);
    setMergeTargetId(firstOtherContact?.id || "");
    setMergeError("");
    setShowForm(false);
    setEditingId(null);
  }

  async function mergeContact(e: React.FormEvent) {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;

    const source = contacts.find((contact) => contact.id === mergeSourceId);
    const target = contacts.find((contact) => contact.id === mergeTargetId);
    if (!source || !target) return;

    const confirmed = window.confirm(
      `Merge ${source.name} into ${target.name}? ${target.name} will stay, identifiers and missing details from ${source.name} will move over, and ${source.name} will be removed.`
    );
    if (!confirmed) return;

    setMerging(true);
    setMergeError("");

    const res = await fetch("/api/contacts/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryContactId: mergeTargetId,
        duplicateContactId: mergeSourceId,
      }),
    });
    const data = await res.json() as { error?: string };

    setMerging(false);

    if (!res.ok) {
      setMergeError(data.error || "Could not merge contacts.");
      return;
    }

    setMergeSourceId(null);
    setMergeTargetId("");
    setSelectedId(mergeTargetId);
    await loadContacts();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      slack_handle: form.slack_handle.trim() || null,
      phone_number: form.phone_number.trim() || null,
      identifiers: form.identifiers
        .map((identifier) => ({
          platform: identifier.platform,
          identifier: identifier.identifier.trim(),
          label: identifier.platform === "slack_user_id" ? "Confirmed Slack user" : identifierLabel(identifier),
          confirmed: identifier.platform !== "slack",
        }))
        .filter((identifier) => identifier.identifier),
      relationship_tags: form.relationship_tags,
      primary_relationship_tag: form.primary_relationship_tag || null,
      notes: form.notes.trim() || null,
      trusted: form.trusted,
    };

    const url = editingId ? `/api/contacts/${editingId}` : "/api/contacts";
    const method = editingId ? "PUT" : "POST";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    loadContacts();
  }

  async function toggleTrusted(c: Contact) {
    await fetch(`/api/contacts/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trusted: !c.trusted }),
    });
    setContacts((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, trusted: !c.trusted } : x))
    );
  }

  async function deleteContact(id: string) {
    if (!window.confirm("Remove this contact?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(null);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  async function refreshInsights(id: string) {
    setGeneratingInsights(true);
    const res = await fetch(`/api/contacts/${id}/insights`, { method: "POST" });
    const data = await res.json() as { insights?: ContactInsights; relationshipSummary?: RelationshipSummary };
    if (data.insights) {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                contact_insights: data.insights,
                contact_relationship_summaries: data.relationshipSummary || c.contact_relationship_summaries || null,
              }
            : c
        )
      );
    }
    setGeneratingInsights(false);
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center" role="status" aria-live="polite">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading contacts</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-3xl text-ink"
            style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
          >
            Contacts
          </h1>
          <p className="text-ink-mid text-sm mt-1">
            People Beckett can recognize across connected tools. Identifiers are optional, but they help Beckett use the right relationship context.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="shrink-0 bg-primary text-white text-sm rounded-pill px-4 py-2 hover:bg-primary-dark transition-colors mt-1"
        >
          + Add contact
        </button>
      </div>

      {/* Search and filters */}
      {contacts.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <label htmlFor="contact-search" className="sr-only">
              Search contacts by name, email, Slack handle, phone, identifier, or relationship
            </label>
            <input
              id="contact-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, Slack, phone, or relationship..."
              className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="relationship-filter" className="sr-only">Filter by relationship tag</label>
            <select
              id="relationship-filter"
              value={relationshipFilter}
              onChange={(e) => setRelationshipFilter(e.target.value)}
              className="w-full border border-border rounded-sm bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All relationship tags</option>
              <option value="trusted">Trusted contacts</option>
              {availableRelationshipTags.map((tag) => (
                <option key={tag} value={tag}>{relationshipTagLabel(tag, customTags)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white border border-border rounded-card p-5 mb-5">
          <h2 className="text-base font-medium text-ink mb-4">
            {editingId ? "Edit contact" : "Add a contact"}
          </h2>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Slack handle</label>
                <input
                  type="text"
                  value={form.slack_handle}
                  onChange={(e) => setForm({ ...form, slack_handle: e.target.value })}
                  placeholder="@handle, display name, or TFH7EK674:UFGK6BHJM"
                  className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-ink-light">
                  Paste Beckett’s confirmed Slack ID here to connect this contact to the real Slack person.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone_number}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <fieldset className="rounded-sm border border-border bg-bg p-4">
              <legend className="px-1 text-sm font-medium text-ink">Relationship tags</legend>
              <p className="mb-3 text-xs leading-relaxed text-ink-light">
                Choose as many as fit. One person can be a colleague and a friend, for example. Beckett only uses this user-editable context when you choose this contact in Practice or include it in meeting preparation.
              </p>
              <div className="flex flex-wrap gap-2">
                {availableRelationshipTags.map((tag) => {
                  const selected = form.relationship_tags.includes(tag);
                  return <button key={tag} type="button" onClick={() => toggleRelationshipTag(tag)} aria-pressed={selected} className={`rounded-pill border px-3 py-1.5 text-xs transition-colors ${selected ? "border-primary bg-primary text-white" : "border-border bg-white text-ink-mid hover:border-primary-mid"}`}>{relationshipTagLabel(tag, customTags)}</button>;
                })}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <label htmlFor="custom-relationship-tag" className="block text-xs font-medium text-ink">Add a custom tag</label>
                  <p className="mt-1 text-xs text-ink-light">Custom tags stay in your tag list so you can reuse them for other contacts.</p>
                </div>
                <div className="flex gap-2">
                  <input id="custom-relationship-tag" value={customRelationshipTag} onChange={(e) => setCustomRelationshipTag(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addCustomRelationshipTag(); } }} maxLength={39} placeholder="e.g. Accountability partner" className="min-w-0 flex-1 rounded-sm border border-border bg-white px-3 py-2 text-xs" />
                  <button type="button" onClick={() => void addCustomRelationshipTag()} className="rounded-pill border border-border bg-white px-3 py-2 text-xs text-ink-mid hover:border-primary-mid">Add</button>
                </div>
              </div>
              {form.relationship_tags.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <label htmlFor="primary-relationship-tag" className="block text-xs font-medium text-ink">Primary tag</label>
                  <p className="mt-1 text-xs text-ink-light">This appears first in short labels. All selected tags remain available as context.</p>
                  <select id="primary-relationship-tag" value={form.primary_relationship_tag} onChange={(e) => setForm({ ...form, primary_relationship_tag: e.target.value })} className="mt-2 w-full max-w-sm rounded-sm border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    {form.relationship_tags.map((tag) => <option key={tag} value={tag}>{relationshipTagLabel(tag, customTags)}</option>)}
                  </select>
                </div>
              )}
              {tagError && <p className="mt-3 text-xs text-red-600" role="alert">{tagError}</p>}
              {customTags.length > 0 && (
                <details className="mt-4 border-t border-border pt-4">
                  <summary className="cursor-pointer text-xs font-medium text-primary">Manage custom tags</summary>
                  <p className="mt-2 text-xs leading-relaxed text-ink-light">Rename a tag everywhere or remove it from your list and the contacts using it.</p>
                  <div className="mt-3 space-y-2">
                    {customTags.map((tag) => (
                      <div key={tag.id} className="flex flex-wrap items-center gap-2">
                        <input value={editingTagLabels[tag.id] || ""} onChange={(e) => setEditingTagLabels((current) => ({ ...current, [tag.id]: e.target.value }))} maxLength={39} aria-label={`Rename ${tag.label}`} className="min-w-[150px] flex-1 rounded-sm border border-border bg-white px-3 py-2 text-xs" />
                        <button type="button" onClick={() => void renameCustomRelationshipTag(tag)} className="rounded-pill border border-border bg-white px-3 py-2 text-xs text-ink-mid hover:border-primary-mid">Save</button>
                        <button type="button" onClick={() => void deleteCustomRelationshipTag(tag)} className="rounded-pill border border-red-200 bg-white px-3 py-2 text-xs text-red-500 hover:bg-red-50">Remove</button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </fieldset>
            <div className="rounded-sm border border-border bg-bg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-ink">Additional identifiers</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-light">
                    Email, Slack, and phone are optional. Confirmed Slack IDs connect to the actual Slack person; display names are only suggestions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addIdentifier}
                  className="shrink-0 border border-border text-xs rounded-pill px-3 py-1.5 text-ink-mid hover:bg-white transition-colors"
                >
                  + Add
                </button>
              </div>
              {form.identifiers.length > 0 && (
                <div className="mt-4 space-y-3">
                  {form.identifiers.map((identifier, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                      <select
                        value={identifier.platform}
                        onChange={(e) => updateIdentifier(index, { platform: e.target.value })}
                        className="w-full border border-border rounded-sm bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {additionalIdentifierOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={identifier.identifier}
                        onChange={(e) => updateIdentifier(index, { identifier: e.target.value })}
                        placeholder={identifier.platform === "slack_user_id" ? "T123456:U123456" : "Identifier"}
                        className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeIdentifier(index)}
                        className="border border-border text-xs rounded-pill px-3 py-2 text-ink-mid hover:bg-white transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Context, communication style, relationship notes…"
                rows={3}
                className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.trusted}
                onChange={(e) => setForm({ ...form, trusted: e.target.checked })}
                className="rounded border-border text-primary"
              />
              <span className="text-sm text-ink">Trusted contact — warmer tone automatically</span>
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-white text-sm rounded-pill px-5 py-2 hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Add contact"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm()); }}
                className="border border-border text-sm rounded-pill px-5 py-2 text-ink-mid hover:bg-bg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {mergeSourceId && (
        <div className="bg-white border border-border rounded-card p-5 mb-5">
          <h2 className="text-base font-medium text-ink mb-2">Merge contacts</h2>
          <p className="text-sm text-ink-mid mb-4">
            Choose the contact to keep. Beckett will move identifiers and missing details from the duplicate, then remove the duplicate contact.
          </p>
          <form onSubmit={mergeContact} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Duplicate to merge</label>
                <div className="rounded-sm border border-border bg-bg px-3 py-2 text-sm text-ink">
                  {contacts.find((contact) => contact.id === mergeSourceId)?.name || "Selected contact"}
                </div>
              </div>
              <div>
                <label htmlFor="merge-target" className="block text-sm font-medium text-ink mb-1">
                  Keep this contact
                </label>
                <select
                  id="merge-target"
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  required
                  className="w-full border border-border rounded-sm bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Choose contact to keep</option>
                  {contacts
                    .filter((contact) => contact.id !== mergeSourceId)
                    .map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                        {contact.email ? ` · ${contact.email}` : ""}
                        {contact.slack_handle ? ` · Slack: ${contact.slack_handle}` : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            {mergeError && (
              <p className="text-sm text-red-600" role="alert">{mergeError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={merging || !mergeTargetId}
                className="bg-primary text-white text-sm rounded-pill px-5 py-2 hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {merging ? "Merging…" : "Merge contacts"}
              </button>
              <button
                type="button"
                onClick={() => { setMergeSourceId(null); setMergeTargetId(""); setMergeError(""); }}
                className="border border-border text-sm rounded-pill px-5 py-2 text-ink-mid hover:bg-bg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedContact && !showForm && !mergeSourceId ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-sm text-primary transition-colors hover:underline"
          >
            ← Back to contacts
          </button>

          <section className="relative bg-white border border-border rounded-card p-6">
            <button
              onClick={() => toggleTrusted(selectedContact)}
              className={`absolute right-5 top-5 text-2xl leading-none transition-colors ${
                selectedContact.trusted ? "text-primary" : "text-ink-light hover:text-primary"
              }`}
              title={selectedContact.trusted ? "Remove trusted" : "Mark trusted"}
              aria-label={selectedContact.trusted ? `Remove ${selectedContact.name} from trusted contacts` : `Mark ${selectedContact.name} as trusted`}
            >
              <span aria-hidden="true">{selectedContact.trusted ? "♥" : "♡"}</span>
            </button>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 pr-10">
                <h2
                  className="text-3xl text-ink"
                  style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
                >
                  {selectedContact.name}
                </h2>
                {relationshipLabel(selectedContact, customTags) && (
                  <p className="mt-1 text-sm text-primary">{relationshipLabel(selectedContact, customTags)}</p>
                )}
                <p className="mt-2 text-sm text-ink-light">
                  Added {new Date(selectedContact.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => openEdit(selectedContact)}
                  className="border border-border text-sm rounded-pill px-4 py-2 text-ink-mid hover:bg-bg transition-colors"
                >
                  Edit
                </button>
                <a
                  href={`/dashboard/practice?mode=professional&person=${encodeURIComponent(selectedContact.name)}&context=${encodeURIComponent(relationshipLabel(selectedContact, customTags))}&scenario=${encodeURIComponent(`Prepare for a conversation with ${selectedContact.name}`)}&goal=${encodeURIComponent("Communicate clearly and leave with a useful next step")}`}
                  className="border border-border text-sm rounded-pill px-4 py-2 text-ink-mid hover:bg-bg transition-colors"
                >
                  Practice with this contact
                </a>
                {contacts.length > 1 && (
                  <button
                    onClick={() => openMerge(selectedContact)}
                    className="border border-border text-sm rounded-pill px-4 py-2 text-ink-mid hover:bg-bg transition-colors"
                  >
                    Merge
                  </button>
                )}
                <button
                  onClick={() => deleteContact(selectedContact.id)}
                  className="border border-red-200 text-sm rounded-pill px-4 py-2 text-red-500 hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-card border border-border bg-bg p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-light">Email</p>
                <p className="break-words text-sm text-ink">{selectedContact.email || "Not added"}</p>
              </div>
              <div className="rounded-card border border-border bg-bg p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-light">Slack</p>
                <p className="break-words text-sm text-ink">{selectedContact.slack_handle || "Not added"}</p>
              </div>
              <div className="rounded-card border border-border bg-bg p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-light">Phone</p>
                <p className="break-words text-sm text-ink">{selectedContact.phone_number || "Not added"}</p>
              </div>
            </div>

            <div className="mt-5 rounded-card border border-border bg-bg p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-light">Relationship tags</p>
              <p className="text-xs leading-relaxed text-ink-light">The primary tag appears first. Beckett uses these only when you choose this contact in Practice or include their context in meeting preparation.</p>
              <RelationshipTagBadges contact={selectedContact} definitions={customTags} className="mt-3" />
            </div>

            <div className="mt-5 rounded-card border border-border bg-bg p-4">
              <div className="mb-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-light">Identifiers</p>
                <p className="mt-1 text-xs text-ink-light">
                  Confirmed identifiers can connect real Gmail, Slack, or phone context. Slack display names remain suggestions.
                </p>
              </div>
              {selectedContact.contact_identifiers?.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedContact.contact_identifiers.map((identifier) => (
                    <span
                      key={`${identifier.platform}:${identifier.identifier}`}
                      className={`max-w-full truncate rounded px-2 py-1 text-xs ${
                        identifier.confirmed ? "bg-white text-ink" : "bg-white text-ink-light"
                      }`}
                      title={`${identifierLabel(identifier)}: ${identifier.identifier}`}
                    >
                      {identifierLabel(identifier)}: {identifier.identifier}
                      {identifier.confirmed ? " · confirmed" : " · suggestion"}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-light">No identifiers added yet.</p>
              )}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="bg-white border border-border rounded-card p-5">
              <h3 className="text-base font-medium text-ink mb-3">Notes</h3>
              {selectedContact.notes ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-mid">{selectedContact.notes}</p>
              ) : (
                <p className="text-sm text-ink-light">No notes yet.</p>
              )}
            </div>

            <div className="bg-white border border-border rounded-card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium text-ink">Relationship insights</h3>
                  <p className="mt-1 text-xs text-ink-light">
                    Summary-level context Beckett can use for coaching. Raw Gmail and Slack history is not stored here.
                  </p>
                </div>
                <button
                  onClick={() => refreshInsights(selectedContact.id)}
                  disabled={generatingInsights}
                  className="shrink-0 text-xs text-primary hover:underline disabled:opacity-50"
                  aria-label={`${selectedContact.contact_insights ? "Refresh" : "Generate"} relationship insights for ${selectedContact.name}`}
                >
                  {generatingInsights ? "Generating…" : selectedContact.contact_insights ? "Refresh" : "Generate"}
                </button>
              </div>

              {selectedRelationshipSummary || selectedContact.contact_insights ? (
                <div className="space-y-4">
                  {selectedRelationshipSummary && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {[
                        { label: "Communication style", value: selectedRelationshipSummary.communication_style },
                        { label: "Common friction", value: selectedRelationshipSummary.recurring_tension_points },
                        { label: "Preferred approach", value: selectedRelationshipSummary.what_tends_to_work },
                        { label: "Unresolved topics", value: selectedRelationshipSummary.unresolved_topics },
                      ].map(({ label, value }) => {
                        if (!value) return null;
                        return (
                          <div key={label} className="rounded-card border border-border bg-bg p-4">
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-light">{label}</p>
                            <p className="text-sm leading-relaxed text-ink-mid">{value}</p>
                          </div>
                        );
                      })}
                      {selectedRelationshipSummary.updated_at && (
                        <p className="text-xs text-ink-light md:col-span-2">
                          Summary updated {new Date(selectedRelationshipSummary.updated_at).toLocaleDateString()}
                          {selectedRelationshipSummary.generated_from ? ` from ${selectedRelationshipSummary.generated_from}` : ""}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedContact.contact_insights && (
                    <div className="grid gap-4 md:grid-cols-2">
                      {[
                        { label: "Summary", key: "summary" },
                        { label: "Communication", key: "communication_patterns" },
                        { label: "Common topics", key: "common_topics" },
                        { label: "Tone trend", key: "tone_trend" },
                        { label: "Responsiveness", key: "responsiveness" },
                      ].map(({ label, key }) => {
                        const val = selectedContact.contact_insights![key as keyof ContactInsights];
                        if (!val) return null;
                        return (
                          <div key={key} className="rounded-card border border-border bg-bg p-4">
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-light">{label}</p>
                            <p className="text-sm leading-relaxed text-ink-mid">{val}</p>
                          </div>
                        );
                      })}
                      {selectedContact.contact_insights.generated_at && (
                        <p className="text-xs text-ink-light md:col-span-2">
                          Insights updated {new Date(selectedContact.contact_insights.generated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-light">
                  No insights yet. Click Generate to analyze this relationship.
                </p>
              )}
            </div>
          </section>
        </div>
      ) : filtered.length === 0 && !showForm ? (
        <div className="mt-6 text-center py-16 bg-white border border-border rounded-card">
          <p className="text-ink-mid text-sm">
            {search ? "No contacts match your search." : "No contacts yet."}
          </p>
          {!search && (
            <p className="text-ink-light text-xs mt-1">
              Add someone to start tracking your relationship context.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((c) => {
            return (
              <div
                key={c.id}
                className="bg-white border border-border rounded-card p-4 transition-colors hover:border-ink-light"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                    </div>
                    <RelationshipTagBadges contact={c} definitions={customTags} className="mt-2" compact />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.email && (
                        <span className="max-w-full truncate rounded bg-bg px-2 py-0.5 text-xs text-ink-light">
                          {c.email}
                        </span>
                      )}
                      {c.slack_handle && (
                        <span className="max-w-full truncate rounded bg-bg px-2 py-0.5 text-xs text-ink-light">
                          Slack: {c.slack_handle}
                        </span>
                      )}
                      {c.contact_identifiers?.some((identifier) => identifier.platform === "slack_user_id") && (
                        <span className="max-w-full truncate rounded bg-bg px-2 py-0.5 text-xs text-ink-light">
                          Slack confirmed
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTrusted(c); }}
                    className={`shrink-0 text-xl leading-none transition-colors ${
                      c.trusted ? "text-primary" : "text-ink-light hover:text-primary"
                    }`}
                    title={c.trusted ? "Remove trusted" : "Mark trusted"}
                    aria-label={c.trusted ? `Remove ${c.name} from trusted contacts` : `Mark ${c.name} as trusted`}
                  >
                    <span aria-hidden="true">{c.trusted ? "♥" : "♡"}</span>
                  </button>
                </div>

                <div className="mt-4 flex gap-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => { setSelectedId(c.id); setShowForm(false); setMergeSourceId(null); }}
                    className="text-xs text-primary transition-colors hover:underline"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="text-xs text-ink-mid transition-colors hover:text-ink"
                  >
                    Edit
                  </button>
                  {contacts.length > 1 && (
                    <button
                      onClick={() => openMerge(c)}
                      className="text-xs text-ink-mid transition-colors hover:text-ink"
                    >
                      Merge
                    </button>
                  )}
                  <button
                    onClick={() => deleteContact(c.id)}
                    className="text-xs text-red-400 transition-colors hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RelationshipTagBadges({
  contact,
  definitions,
  className = "",
  compact = false,
}: {
  contact: Pick<Contact, "relationship_type" | "relationship_other" | "relationship_tags" | "primary_relationship_tag">;
  definitions: RelationshipTagDefinition[];
  className?: string;
  compact?: boolean;
}) {
  const tags = relationshipTagsForContact(contact);
  const primary = primaryRelationshipTagForContact(contact);
  const ordered = primary ? [primary, ...tags.filter((tag) => tag !== primary)] : tags;
  if (!ordered.length) return <p className={`${className} text-sm text-ink-light`}>No relationship tags yet.</p>;
  return (
    <div className={`${className} flex flex-wrap gap-1.5`}>
      {ordered.map((tag) => (
        <span key={tag} className={`rounded-pill px-2 py-1 text-xs ${tag === primary ? "bg-primary-light text-ink" : "bg-white text-ink-mid"}`}>
          {relationshipTagLabel(tag, definitions)}{!compact && tag === primary ? " · primary" : ""}
        </span>
      ))}
    </div>
  );
}
