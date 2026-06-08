"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  slack_handle: string | null;
  phone_number: string | null;
  notes: string | null;
  trusted: boolean;
  created_at: string;
  contact_insights?: ContactInsights | null;
};

type ContactInsights = {
  summary: string | null;
  communication_patterns: string | null;
  common_topics: string | null;
  tone_trend: string | null;
  responsiveness: string | null;
  generated_at: string | null;
};

const emptyForm = () => ({
  name: "",
  email: "",
  slack_handle: "",
  phone_number: "",
  notes: "",
  trusted: false,
});

export default function ContactsPage() {
  const supabase = createClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  const loadContacts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("contacts")
      .select("*, contact_insights(*)")
      .eq("user_id", user.id)
      .order("name");
    setContacts((data as Contact[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.slack_handle?.toLowerCase().includes(q)
    );
  });

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  function openAdd() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
    setSelectedId(null);
  }

  function openEdit(c: Contact) {
    setForm({
      name: c.name,
      email: c.email || "",
      slack_handle: c.slack_handle || "",
      phone_number: c.phone_number || "",
      notes: c.notes || "",
      trusted: c.trusted,
    });
    setEditingId(c.id);
    setShowForm(true);
    setSelectedId(null);
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
    const data = await res.json() as { insights?: ContactInsights };
    if (data.insights) {
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, contact_insights: data.insights } : c))
      );
    }
    setGeneratingInsights(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
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
            People Beckett knows about. Trusted contacts get a warmer tone automatically.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="shrink-0 bg-primary text-white text-sm rounded-pill px-4 py-2 hover:bg-primary-dark transition-colors mt-1"
        >
          + Add contact
        </button>
      </div>

      {/* Search */}
      {contacts.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or Slack handle…"
          className="w-full border border-border rounded-sm px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-primary"
        />
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
                  placeholder="@handle or display name"
                  className="w-full border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
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

      {/* Contact list + detail split */}
      {filtered.length === 0 && !showForm ? (
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
        <div className="flex gap-4">
          {/* List */}
          <div className="flex-1 space-y-2 min-w-0">
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                className={`bg-white border rounded-card p-4 cursor-pointer transition-colors ${
                  selectedId === c.id
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-ink-light"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink">{c.name}</p>
                      {c.trusted && <span className="text-base leading-none">💛</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {c.email && (
                        <span className="text-xs bg-bg text-ink-light rounded px-2 py-0.5">
                          {c.email}
                        </span>
                      )}
                      {c.slack_handle && (
                        <span className="text-xs bg-bg text-ink-light rounded px-2 py-0.5">
                          Slack: {c.slack_handle}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleTrusted(c)}
                      className="text-xs text-ink-light hover:text-amber-500 transition-colors"
                      title={c.trusted ? "Remove trusted" : "Mark trusted"}
                    >
                      {c.trusted ? "💛" : "♡"}
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs text-ink-mid hover:text-ink transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteContact(c.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-72 shrink-0 bg-white border border-border rounded-card p-5 self-start sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-base font-medium text-ink flex-1 truncate">{selected.name}</h3>
                {selected.trusted && <span>💛</span>}
              </div>

              {selected.notes && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-ink-light uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-xs text-ink-mid leading-relaxed">{selected.notes}</p>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-ink-light uppercase tracking-wide">
                    Relationship insights
                  </p>
                  <button
                    onClick={() => refreshInsights(selected.id)}
                    disabled={generatingInsights}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {generatingInsights ? "Generating…" : selected.contact_insights ? "Refresh" : "Generate"}
                  </button>
                </div>

                {selected.contact_insights ? (
                  <div className="space-y-3">
                    {[
                      { label: "Summary", key: "summary" },
                      { label: "Communication", key: "communication_patterns" },
                      { label: "Common topics", key: "common_topics" },
                      { label: "Tone trend", key: "tone_trend" },
                      { label: "Responsiveness", key: "responsiveness" },
                    ].map(({ label, key }) => {
                      const val = selected.contact_insights![key as keyof ContactInsights];
                      if (!val) return null;
                      return (
                        <div key={key}>
                          <p className="text-xs font-medium text-ink mb-0.5">{label}</p>
                          <p className="text-xs text-ink-mid leading-relaxed">{val}</p>
                        </div>
                      );
                    })}
                    {selected.contact_insights.generated_at && (
                      <p className="text-xs text-ink-light pt-1">
                        Updated {new Date(selected.contact_insights.generated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-ink-light">
                    No insights yet. Click Generate to analyse this relationship.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
