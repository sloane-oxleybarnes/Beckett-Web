'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import type { AdaptiveNudge, AdaptiveReplay } from '@/lib/adaptive-conversation'
import { AssessmentViewUpdated, Field, ReviewRow, TextArea, VideoCallFrame, displayPersonName } from './AdaptiveConversationViews'
import { createAdaptiveSession, loadAdaptiveSimulator } from './adaptive-conversation-api'
import { blankAdaptiveSetup as blankSetup, type AdaptiveContact as Contact, type AdaptiveMessage as Message, type AdaptiveSessionAssessment as Assessment, type AdaptiveSetup as Setup, type SavedAdaptiveSession as SavedSession } from './adaptive-conversation-schema'

export default function AdaptiveConversationSimulator({ embedded = false }: { embedded?: boolean }) {
  const [setup, setSetup] = useState<Setup>(blankSetup)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [nudge, setNudge] = useState<AdaptiveNudge | null>(null)
  const [stage, setStage] = useState<'setup' | 'review' | 'conversation' | 'assessment' | 'replay'>('setup')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [typing, setTyping] = useState(false)
  const [paused, setPaused] = useState(false)
  const [helpText, setHelpText] = useState('')
  const [endReason, setEndReason] = useState('')
  const [replay, setReplay] = useState<AdaptiveReplay | null>(null)
  const [replayInput, setReplayInput] = useState('')
  const [replayBusy, setReplayBusy] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [openingLine, setOpeningLine] = useState('')
  const [keyAsk, setKeyAsk] = useState('')
  const [openingLineLoading, setOpeningLineLoading] = useState(false)
  const lastVoiceTranscriptRef = useRef<Record<string, number>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    loadAdaptiveSimulator()
      .then((body) => {
        setContacts(body.contacts || [])
        setSavedSessions(body.sessions || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function refreshHistory() {
    try {
      const body = await loadAdaptiveSimulator()
      setSavedSessions(body.sessions || [])
    } catch { /* History refresh is best-effort. */ }
  }

  function updateSetup(field: keyof Setup, value: string) {
    setSetup((current) => ({ ...current, [field]: value }))
  }

  function selectContact(id: string) {
    const contact = contacts.find((item) => item.id === id)
    updateSetup('contactId', id)
    if (contact) {
      updateSetup('person', contact.name)
      updateSetup('approvedContactContext', [contact.relationship_type || contact.relationship_other, contact.notes].filter(Boolean).join('\n'))
    }
  }

  async function generateOpeningLine(id: string) {
    setOpeningLine('')
    setKeyAsk('')
    setOpeningLineLoading(true)
    try {
      const res = await fetch(`/api/labs/adaptive-conversation/${id}/opening-line`, { method: 'POST' })
      const body = await res.json().catch(() => null) as { openingLine?: string; keyAsk?: string } | null
      if (res.ok) {
        if (body?.openingLine) setOpeningLine(body.openingLine)
        if (body?.keyAsk) setKeyAsk(body.keyAsk)
      }
    } catch {
      setOpeningLine('')
      setKeyAsk('')
    } finally {
      setOpeningLineLoading(false)
    }
  }

  function reviewSetup(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!setup.person.trim() || !setup.situation.trim() || !setup.goal.trim()) {
      setError('Add the person, situation, and goal before reviewing the setup.')
      return
    }
    if (setup.scenarioType === 'contact' && !setup.contactId) {
      setError('Choose a contact before reviewing the setup.')
      return
    }
    // Video is not part of the submission experience. Normalize any older
    // saved video setup to text before it reaches the review or start flow.
    if (setup.channel === 'video') setSetup((current) => ({ ...current, channel: 'text' }))
    setStage('review')
  }

  async function beginSimulation() {
    setBusy(true)
    setError('')
    try {
      const approvedSetup: Setup = { ...setup, channel: setup.channel === 'phone' ? 'phone' : 'text' }
      const body = await createAdaptiveSession(approvedSetup)
      setSessionId(body.session.id)
      setMessages([])
      setAssessment(null)
      setReplay(null)
      setNudge(null)
      setSpeaking(false)
      setAudioError('')
      setOpeningLine('')
      setKeyAsk('')
      lastVoiceTranscriptRef.current = {}
      setPaused(false)
      setHelpText('')
      setTyping(false)
      setEndReason('')
      setStage('conversation')
      void generateOpeningLine(body.session.id)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not start the simulation.') }
    finally { setBusy(false) }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    if (!sessionId || !input.trim() || busy || paused || endReason) return
    const message = input.trim()
    const previousMessages = messages
    const optimisticMessage: Message = {
      role: 'user',
      content: message,
      turn: messages.filter((item) => item.role === 'user').length + 1,
      createdAt: new Date().toISOString(),
    }
    setInput('')
    setMessages([...messages, optimisticMessage])
    setBusy(true)
    setTyping(true)
    setError('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 45000)
    try {
      const res = await fetch(`/api/labs/adaptive-conversation/${sessionId}/turn`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }), signal: controller.signal,
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'The simulated person could not respond.')
      setMessages(body.transcript || [])
      if (body.conversationStatus === 'ended' || body.conversationStatus === 'ending') {
        setEndReason(body.endReason || 'The conversation has reached a natural stopping point.')
      }
      void requestNudge()
    } catch (err) {
      setMessages(previousMessages)
      setError(err instanceof DOMException && err.name === 'AbortError' ? 'The simulated person took too long to respond. Your message is still here—try sending again.' : err instanceof Error ? err.message : 'The simulated person could not respond.')
      setInput(message)
    }
    finally { window.clearTimeout(timeout); setBusy(false); setTyping(false) }
  }

  async function saveVoiceTranscript(role: 'user' | 'simulated_person', content: string) {
    if (endReason) return
    const key = `${role}:${content.trim()}`
    const nowMs = new Date().getTime()
    if (nowMs - (lastVoiceTranscriptRef.current[key] || 0) < 2500) return
    lastVoiceTranscriptRef.current[key] = nowMs
    const item: Message = { role, content, turn: role === 'user' ? messages.filter((message) => message.role === 'user').length + 1 : Math.max(1, messages.filter((message) => message.role === 'user').length), createdAt: new Date().toISOString() }
    setMessages((current) => [...current, item])
    if (sessionId) {
      await fetch(`/api/labs/adaptive-conversation/${sessionId}/realtime/transcript`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, content }) })
      if (role === 'simulated_person' && setup.channel === 'text') void requestNudge()
    }
  }

  async function requestNudge() {
    if (!sessionId || stage !== 'conversation') return
    const response = await fetch(`/api/labs/adaptive-conversation/${sessionId}/nudge`, { method: 'POST' })
    if (!response.ok) return
    const result = await response.json() as AdaptiveNudge
    if (result.shouldNudge) setNudge(result)
  }

  async function askForHelp() {
    if (!sessionId || busy || messages.length < 2) return
    setBusy(true)
    setError('')
    setPaused(true)
    try {
      const res = await fetch(`/api/labs/adaptive-conversation/${sessionId}/help`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Help is unavailable right now.')
      setHelpText(body.help || '')
    } catch (err) { setError(err instanceof Error ? err.message : 'Help is unavailable right now.') }
    finally { setBusy(false) }
  }

  async function stopSimulation() {
    if (!sessionId || busy) return
    setBusy(true)
    try {
      await fetch(`/api/labs/adaptive-conversation/${sessionId}/stop`, { method: 'POST' })
      await refreshHistory()
    }
    finally { setBusy(false); reset() }
  }

  async function finishSimulation(videoTranscript?: Message[]) {
    const transcript = videoTranscript || messages
    if (!sessionId || busy) return
    if (transcript.length < 2) {
      setError('The call ended, but Beckett needs at least one complete exchange before it can create a debrief.')
      return
    }
    setBusy(true)
    setError('')
    setAssessment(null)
    setAssessmentLoading(true)
    setStage('assessment')
    try {
      const res = await fetch(`/api/labs/adaptive-conversation/${sessionId}/finish`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'The assessment could not be generated.')
      setAssessment(body.assessment)
      await refreshHistory()
    } catch (err) { setError(err instanceof Error ? err.message : 'The assessment could not be generated.'); setStage('conversation') }
    finally { setBusy(false); setAssessmentLoading(false) }
  }

  function startReplay() {
    setReplayInput('')
    setError('')
    setStage('replay')
  }

  async function sendReplay(event: FormEvent) {
    event.preventDefault()
    if (!sessionId || !replayInput.trim() || replayBusy || !assessment?.replayPoint) return
    setReplayBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/labs/adaptive-conversation/${sessionId}/replay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replayInput.trim(), ...(replay ? {} : { turn: assessment.replayPoint.turn }) }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'The replay could not respond.')
      setReplay(body.replay)
      setReplayInput('')
    } catch (err) { setError(err instanceof Error ? err.message : 'The replay could not respond.') }
    finally { setReplayBusy(false) }
  }

  function reset() { setSetup(blankSetup); setSessionId(null); setMessages([]); setAssessment(null); setAssessmentLoading(false); setReplay(null); setNudge(null); setReplayInput(''); setPaused(false); setHelpText(''); setEndReason(''); setSpeaking(false); setAudioError(''); setOpeningLine(''); setKeyAsk(''); setOpeningLineLoading(false); lastVoiceTranscriptRef.current = {}; setStage('setup'); setError('') }

  async function deleteSession(id: string) {
    if (!window.confirm('Delete this saved simulation and its transcript?')) return
    const res = await fetch(`/api/labs/adaptive-conversation/${id}`, { method: 'DELETE' })
    if (res.ok) setSavedSessions((current) => current.filter((item) => item.id !== id))
    else setError('That simulation could not be deleted.')
  }

  function retrySession(item: SavedSession) {
    const snapshot = item.setup_snapshot
    setSetup({
      ...blankSetup,
      ...snapshot,
      scenarioType: snapshot.scenarioType === 'contact' ? 'contact' : 'general',
      channel: snapshot.channel === 'phone' ? 'phone' : 'text',
      voicePreference: snapshot.voicePreference || 'gender_neutral',
      difficulty: snapshot.difficulty || 'realistic',
      contactId: snapshot.contactId || '',
    })
    setSessionId(null)
    setMessages([])
    setAssessment(null)
    setReplay(null)
    setError('')
    setStage('review')
  }

  if (loading) return <main className="mx-auto max-w-5xl px-6 py-12 text-sm text-ink-mid">Loading the simulator…</main>

  const replayMessages = assessment?.replayPoint ? messages.filter((message) => message.turn === assessment.replayPoint?.turn) : []

  return (
    <main className="min-h-screen bg-[#FBF8F3] px-5 py-8 text-ink sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{embedded ? 'Practice' : 'Beckett Labs'}</p>
            <h1 className="mt-2 text-4xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>{embedded ? 'Practice a conversation' : 'Adaptive Conversation Simulator'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mid">Practice one difficult conversation with a simulated person who can hesitate, misunderstand, push back, and change their mind.</p>
          </div>
          {stage !== 'setup' && <button onClick={reset} className="rounded-pill border border-border bg-white px-4 py-2 text-sm text-ink hover:border-primary">New simulation</button>}
        </div>

        {error && <div role="alert" className="mb-5 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        {stage === 'replay' && assessment?.replayPoint && <div className="mx-auto mb-4 max-w-3xl rounded-card border border-primary/20 bg-primary-light/30 p-5"><p className="text-xs font-medium uppercase tracking-wide text-primary">Original exchange {assessment.replayPoint.turn}</p>{replayMessages.map((message, index) => <div key={`${message.createdAt}-${index}`} className={`mt-3 rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'ml-8 bg-primary text-white' : 'mr-8 bg-white text-ink'}`}><p className="mb-1 text-[10px] font-medium uppercase tracking-wide opacity-60">{message.role === 'user' ? 'You originally said' : displayPersonName(setup.person)}</p>{message.content}</div>)}<p className="mt-3 text-xs text-ink-light">Your alternate response will replace your original message at this moment.</p></div>}

        {stage === 'setup' && <section className="mx-auto max-w-3xl">
          <form onSubmit={reviewSetup} className="rounded-card border border-border bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-light">Step 1</p>
            <h2 className="mt-1 text-2xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Set up the conversation</h2>
            <p className="mt-2 text-sm leading-6 text-ink-mid">Start with a general situation or a Beckett contact. You will approve the exact context before anything begins.</p>
            <div className="mt-6 flex gap-2">
              {(['general', 'contact'] as const).map((type) => <button key={type} type="button" onClick={() => updateSetup('scenarioType', type)} className={`rounded-pill px-4 py-2 text-sm ${setup.scenarioType === type ? 'bg-primary text-white' : 'border border-border bg-white text-ink-mid'}`}>{type === 'general' ? 'General scenario' : 'Existing contact'}</button>)}
            </div>
            <div className="mt-5"><p className="text-sm font-medium">Practice channel</p><div className="mt-2 flex flex-wrap gap-2">{(['text', 'phone'] as const).map((channel) => <button key={channel} type="button" onClick={() => updateSetup('channel', channel)} className={`rounded-pill px-4 py-2 text-sm ${setup.channel === channel ? 'bg-primary text-white' : 'border border-border bg-white text-ink-mid'}`}>{channel === 'text' ? 'Text conversation' : 'Phone call'}</button>)}</div><p className="mt-2 text-xs text-ink-light">Choose text for a written exchange or phone for a spoken practice call. Both use the same simulator and debrief.</p></div>
            {setup.channel === 'phone' && <div className="mt-5"><p className="text-sm font-medium">Persona voice</p><div className="mt-2 flex flex-wrap gap-2">{([['masculine', 'Masculine'], ['feminine', 'Feminine'], ['gender_neutral', 'Gender-neutral']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => updateSetup('voicePreference', value)} className={`rounded-pill px-4 py-2 text-sm ${setup.voicePreference === value ? 'bg-primary text-white' : 'border border-border bg-white text-ink-mid'}`}>{label}</button>)}</div><p className="mt-2 text-xs text-ink-light">Choose the voice style for this phone practice. Gender-neutral is the default.</p></div>}
            <div className="mt-5"><p className="text-sm font-medium">Simulation mode</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{(['realistic', 'supportive', 'challenging'] as const).map((difficulty) => <button key={difficulty} type="button" onClick={() => updateSetup('difficulty', difficulty)} className={`rounded-card border px-3 py-3 text-left ${setup.difficulty === difficulty ? 'border-primary bg-primary-light/40' : 'border-border bg-white'}`}><span className="block text-sm font-medium capitalize">{difficulty}</span><span className="mt-1 block text-xs leading-5 text-ink-light">{difficulty === 'realistic' ? 'Balanced and plausible.' : difficulty === 'supportive' ? 'More patient, still authentic.' : 'More guarded, never hostile.'}</span></button>)}</div></div>
            {setup.scenarioType === 'contact' && <label className="mt-5 block text-sm font-medium">Contact<select value={setup.contactId} onChange={(e) => selectContact(e.target.value)} className="mt-2 block w-full rounded-card border border-border bg-white px-3 py-3 font-normal"><option value="">Choose a contact…</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Who are you talking to?" value={setup.person} onChange={(v) => updateSetup('person', v)} placeholder="e.g. my manager" />
              <Field label="Your goal" value={setup.goal} onChange={(v) => updateSetup('goal', v)} placeholder="What would a good outcome be?" />
            </div>
            <TextArea label="What is the situation?" value={setup.situation} onChange={(v) => updateSetup('situation', v)} placeholder="What needs to be discussed?" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What are you concerned about?" value={setup.concern} onChange={(v) => updateSetup('concern', v)} placeholder="Optional" />
              <Field label="Relationship context" value={setup.relationshipContext} onChange={(v) => updateSetup('relationshipContext', v)} placeholder="Optional" />
              <Field label="Their communication style" value={setup.personStyle} onChange={(v) => updateSetup('personStyle', v)} placeholder="Optional" />
              <Field label="Constraints or pressure" value={setup.constraints} onChange={(v) => updateSetup('constraints', v)} placeholder="Optional" />
            </div>
            <button type="submit" className="mt-6 rounded-pill bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-dark">Review setup →</button>
          </form>
        </section>}

        {stage === 'conversation' && endReason && <div className="mx-auto mb-4 max-w-3xl rounded-card border border-primary/20 bg-primary-light/30 p-4 text-sm leading-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">Natural stopping point</p><p className="mt-2">{endReason}</p><p className="mt-2 text-xs text-ink-light">You can finish and assess this conversation, including if it ended with disagreement or ambiguity.</p></div>}
        {stage === 'conversation' && setup.person.trim() && setup.situation.trim() && <div className="mx-auto mb-4 max-w-3xl rounded-card border border-primary/20 bg-primary-light/30 p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Suggested opening line</p>{openingLineLoading ? <p className="mt-2 text-sm text-ink-mid">Beckett is drafting a natural way to start…</p> : openingLine ? <><p className="mt-2 text-sm leading-6 text-ink">“{openingLine}”</p><p className="mt-1 text-xs text-ink-light">Use it as-is or make it sound like you.</p>{keyAsk && <><p className="mt-4 text-xs font-medium uppercase tracking-wide text-primary">Suggested key ask</p><p className="mt-2 text-sm leading-6 text-ink">“{keyAsk}”</p><p className="mt-1 text-xs text-ink-light">Use this after the opener, or make it sound like you.</p></>}</> : <p className="mt-2 text-sm text-ink-mid">Start in your own words when you’re ready.</p>}</div>}
        {stage === 'conversation' && <p className="mx-auto mb-2 max-w-3xl text-xs text-ink-light">{setup.channel === 'phone' ? 'Phone call' : 'Text conversation'} · <span className="capitalize">{setup.difficulty}</span> mode</p>}

        {stage === 'conversation' && nudge && <div className="mx-auto mb-4 max-w-3xl rounded-card border border-primary/20 bg-primary-light/30 p-4 text-sm leading-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">Beckett’s nudge</p><p className="mt-2">{nudge.prompt}</p>{nudge.examples?.length > 0 && <p className="mt-2 text-ink-mid">Try: “{nudge.examples.join('” or “')}”</p>}<button type="button" onClick={() => { setPaused(true); setHelpText(nudge.prompt); setNudge(null) }} className="mt-3 text-xs font-medium text-primary hover:underline">Pause and work on this</button><button type="button" onClick={() => setNudge(null)} className="ml-4 mt-3 text-xs text-ink-light hover:underline">Keep practicing</button></div>}
        {stage === 'conversation' && setup.channel === 'phone' && <VideoCallFrame sessionId={sessionId} person={displayPersonName(setup.person)} messages={messages} typing={typing} speaking={speaking} audioError={audioError} input={input} setInput={setInput} onSubmit={sendMessage} onVoiceTranscript={saveVoiceTranscript} onTranscriptSync={setMessages} onSupervisorUpdate={setNudge} onSpeakingChange={setSpeaking} onEnd={finishSimulation} onPause={() => setPaused((value) => !value)} paused={paused} disabled={busy} channel="phone" />}

        {stage === 'review' && <section className="mx-auto max-w-3xl rounded-card border border-border bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-light">Step 2</p>
          <h2 className="mt-1 text-2xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Review and approve</h2>
          <p className="mt-2 text-sm leading-6 text-ink-mid">This is the session-specific context GPT‑5.6 will use. It will not change the permanent contact.</p>
          <div className="mt-6 space-y-4 rounded-card bg-[#FBF8F3] p-5 text-sm"><ReviewRow label="Practice channel" value={setup.channel === 'phone' ? 'Phone call' : 'Text conversation'} />{setup.channel === 'phone' && <ReviewRow label="Persona voice" value={setup.voicePreference === 'masculine' ? 'Masculine' : setup.voicePreference === 'feminine' ? 'Feminine' : 'Gender-neutral'} />}<ReviewRow label="Person" value={setup.person} /><ReviewRow label="Situation" value={setup.situation} /><ReviewRow label="Goal" value={setup.goal} /><ReviewRow label="Concern" value={setup.concern || 'Not specified'} /><ReviewRow label="Relationship context" value={setup.relationshipContext || 'Not specified'} />{setup.scenarioType === 'contact' && <ReviewRow label="Approved contact context" value={setup.approvedContactContext || 'No additional context'} />}</div>
          <p className="mt-5 rounded-card border border-primary/20 bg-primary-light/30 p-4 text-sm leading-6 text-ink"><strong>Important:</strong> This is one plausible simulated response, not a prediction of how the real person will behave. New details introduced during role-play remain simulation-only.</p>
          <p className="mt-3 text-xs text-ink-light">Mode: <span className="font-medium capitalize">{setup.difficulty}</span> · This changes the person’s level of patience and resistance, not the underlying scenario.</p>
          <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => setStage('setup')} className="rounded-pill border border-border px-4 py-2 text-sm">Edit setup</button><button onClick={beginSimulation} disabled={busy} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Starting…' : 'Approve and begin →'}</button></div>
        </section>}

        {stage === 'conversation' && setup.channel === 'text' && <section className="mx-auto max-w-3xl"><div className="mb-4 rounded-card border border-primary/20 bg-primary-light/30 p-4 text-sm leading-6"><strong>{displayPersonName(setup.person)}</strong> is the simulated person in this text conversation. Stay in character; ask for help or finish whenever you are ready.</div><div className="rounded-card border border-border bg-white p-5 shadow-sm"><div className="min-h-[360px] space-y-4">{messages.length === 0 && <p className="py-16 text-center text-sm text-ink-light">Start the conversation when you are ready.</p>}{messages.map((message, index) => <div key={`${message.createdAt}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-white' : 'bg-[#FBF8F3] text-ink'}`}><p className="mb-1 text-[10px] font-medium uppercase tracking-wide opacity-60">{message.role === 'user' ? 'You' : displayPersonName(setup.person)}</p>{message.content}</div></div>)}{typing && <div className="flex justify-start" aria-live="polite"><div className="rounded-2xl bg-[#FBF8F3] px-4 py-3 text-sm text-ink-mid"><span className="mr-2 text-[10px] font-medium uppercase tracking-wide text-ink-light">{displayPersonName(setup.person)} is responding</span><span className="inline-flex gap-1 align-middle"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-light" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-light [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-light [animation-delay:300ms]" /></span></div></div>}</div>{helpText && <div className="mt-5 rounded-card border border-primary/20 bg-primary-light/30 p-4 text-sm leading-6"><p className="text-xs font-medium uppercase tracking-wide text-primary">Beckett’s pause note</p><p className="mt-2">{helpText}</p><button type="button" onClick={() => { setHelpText(''); setPaused(false) }} className="mt-3 text-xs font-medium text-primary hover:underline">Return to role-play</button></div>}<form onSubmit={sendMessage} className="mt-5 border-t border-border pt-4"><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={paused ? 'Role-play is paused.' : 'What would you like to say?'} rows={3} className="w-full resize-none rounded-card border border-border px-4 py-3 text-sm outline-none focus:border-primary" disabled={busy || paused} /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-ink-light">{messages.filter((m) => m.role === 'user').length} exchanges · {paused ? 'Paused' : `${setup.difficulty} mode`}</span><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setPaused((value) => !value)} disabled={busy} className="rounded-pill border border-border px-3 py-2 text-xs">{paused ? 'Resume' : 'Pause'}</button><button type="button" onClick={askForHelp} disabled={busy || messages.length < 2} className="rounded-pill border border-primary/40 px-3 py-2 text-xs text-primary disabled:opacity-40">Ask for help</button><button type="button" onClick={stopSimulation} disabled={busy} className="rounded-pill border border-red-200 px-3 py-2 text-xs text-red-700">Stop</button><button type="button" onClick={() => { void finishSimulation() }} disabled={busy || messages.length < 2} className="rounded-pill border border-primary/40 px-3 py-2 text-xs text-primary disabled:opacity-40">{busy ? 'Working…' : 'Finish and assess'}</button><button type="submit" disabled={busy || paused || !input.trim()} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-40">{busy ? 'Replying…' : 'Send'}</button></div></div></form></div></section>}

        {stage === 'assessment' && assessmentLoading && <section className="mx-auto max-w-3xl rounded-card border border-border bg-white p-8 text-center shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-primary">Conversation ended</p><h2 className="mt-2 text-3xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Preparing your debrief…</h2><p className="mt-3 text-sm leading-6 text-ink-mid">The role-play is finished. Beckett is reviewing the transcript for turning points, resistance, goal progress, and a useful replay point.</p><div className="mx-auto mt-6 h-2 max-w-xs overflow-hidden rounded-pill bg-primary-light"><div className="h-full w-1/2 animate-pulse rounded-pill bg-primary" /></div></section>}
        {stage === 'assessment' && assessment && <AssessmentViewUpdated assessment={assessment} canReplay={setup.channel === 'text'} onNew={reset} onReplay={startReplay} />}

        {stage === 'replay' && setup.channel === 'text' && assessment?.replayPoint && <section className="mx-auto max-w-3xl"><div className="rounded-card border border-border bg-white p-6 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-primary">Replay a turning point</p><h2 className="mt-1 text-3xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Try the moment again</h2><p className="mt-3 text-sm leading-6 text-ink-mid">The original session is preserved. You are restoring the conversation immediately before exchange {assessment.replayPoint.turn}; your next response will create a separate branch.</p>{replay && <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-card bg-[#FBF8F3] p-4"><p className="text-xs font-medium uppercase tracking-wide text-ink-light">Original trajectory</p><p className="mt-2 text-sm font-medium capitalize">{replay.originalTrajectory}</p><p className="mt-2 text-sm leading-6 text-ink-mid">{replay.originalOutcome}</p></div><div className="rounded-card border border-primary/20 bg-primary-light/30 p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Replay trajectory</p><p className="mt-2 text-sm font-medium capitalize">{replay.replayTrajectory}</p><p className="mt-2 text-sm leading-6 text-ink-mid">{replay.replayOutcome}</p></div></div>}{replay && <div className="mt-6 space-y-3 border-t border-border pt-5">{replay.transcript.map((message, index) => <div key={`${message.createdAt}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-white' : 'bg-[#FBF8F3] text-ink'}`}><p className="mb-1 text-[10px] font-medium uppercase tracking-wide opacity-60">{message.role === 'user' ? 'Your replay' : displayPersonName(setup.person)}</p>{message.content}</div></div>)}</div>}<form onSubmit={sendReplay} className="mt-6 border-t border-border pt-5"><label className="text-sm font-medium">{replay ? 'Continue the replay' : `What would you say differently to ${displayPersonName(setup.person)}?`}<textarea value={replayInput} onChange={(e) => setReplayInput(e.target.value)} rows={4} placeholder="Try a different response…" className="mt-2 w-full resize-none rounded-card border border-border px-4 py-3 text-sm outline-none focus:border-primary" disabled={replayBusy} /></label><div className="mt-3 flex justify-between gap-3"><button type="button" onClick={() => setStage('assessment')} className="rounded-pill border border-border px-4 py-2 text-sm">Back to assessment</button><button type="submit" disabled={replayBusy || !replayInput.trim()} className="rounded-pill bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-40">{replayBusy ? 'Replaying…' : replay ? 'Continue replay' : 'Try this response →'}</button></div></form></div></section>}

        {stage === 'setup' && savedSessions.length > 0 && <section className="mt-8 rounded-card border border-border bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-ink-light">Saved simulations</p><h2 className="mt-1 text-xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Your recent practice</h2></div><p className="text-xs text-ink-light">Full transcripts are saved until you delete them.</p></div><div className="mt-4 divide-y divide-border">{savedSessions.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-medium">{item.setup_snapshot?.person || 'Conversation'}</p><p className="text-xs text-ink-light">{item.setup_snapshot?.situation || 'Saved simulation'} · {new Date(item.updated_at).toLocaleDateString()}</p></div><div className="flex items-center gap-3"><button onClick={() => retrySession(item)} className="text-xs font-medium text-primary hover:underline">Retry this situation</button><button onClick={() => deleteSession(item.id)} className="text-xs text-red-700 hover:underline">Delete</button></div></div>)}</div></section>}
      </div>
    </main>
  )
}
