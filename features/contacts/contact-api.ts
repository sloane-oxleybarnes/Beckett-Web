import { normalizeContactFromApi, type Contact } from './contact-model'
import type { RelationshipTagDefinition } from '@/lib/relationship-tags'

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error || 'The contact request failed.')
  return body
}

export async function fetchContacts(): Promise<Contact[]> {
  const body = await json<{ contacts?: Contact[] }>(await fetch('/api/contacts'))
  return (body.contacts || []).map(normalizeContactFromApi)
}

export async function fetchRelationshipTags(): Promise<RelationshipTagDefinition[]> {
  const body = await json<{ tags?: RelationshipTagDefinition[] }>(await fetch('/api/relationship-tags'))
  return body.tags || []
}

export async function createRelationshipTag(label: string) {
  return json<{ tag: RelationshipTagDefinition }>(await fetch('/api/relationship-tags', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }),
  }))
}

export async function updateRelationshipTag(id: string, label: string) {
  return json<{ tag: RelationshipTagDefinition }>(await fetch(`/api/relationship-tags/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }),
  }))
}

export async function removeRelationshipTag(id: string) {
  await json<{ ok: true }>(await fetch(`/api/relationship-tags/${id}`, { method: 'DELETE' }))
}
