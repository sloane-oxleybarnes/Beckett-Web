import type { AdaptiveSetup, SavedAdaptiveSession } from './adaptive-conversation-schema'

type SimulatorIndexResponse = { contacts?: Array<{ id: string; name: string; notes: string | null; relationship_type: string | null; relationship_other: string | null }>; sessions?: SavedAdaptiveSession[]; error?: string }

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error || 'The simulator request failed.')
  return body
}

export async function loadAdaptiveSimulator() {
  return readJson<SimulatorIndexResponse>(await fetch('/api/labs/adaptive-conversation'))
}

export async function createAdaptiveSession(setup: AdaptiveSetup) {
  return readJson<{ session: { id: string } }>(await fetch('/api/labs/adaptive-conversation', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...setup, approved: true }),
  }))
}

export async function deleteAdaptiveSession(id: string) {
  return readJson<{ ok: true }>(await fetch(`/api/labs/adaptive-conversation/${id}`, { method: 'DELETE' }))
}
