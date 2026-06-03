'use client'
import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { SKILL_MODULES, type Scenario } from '@/lib/skills'

type Phase = 'tips' | 'context' | 'steps' | 'practice' | 'debrief'
type Message = { role: 'user' | 'assistant'; content: string }
type TrustedPerson = { id: string; name: string; relationship: string; communication_style: string; notes: string }
type DebriefData = { other_person_felt: string; how_you_came_across: string; what_went_well: string; things_to_work_on: string }

const qualityStyle: Record<string, string> = {
  good: 'border-green-300 bg-green-50',
  okay: 'border-amber-300 bg-amber-50',
  avoid: 'border-red-300 bg-red-50',
}
const qualityLabel: Record<string, string> = { good: 'Good choice', okay: 'Okay, but…', avoid: 'Avoid this' }
const qualityText: Record<string, string> = { good: 'text-green-700', okay: 'text-amber-700', avoid: 'text-red-700' }

function ProgressMeter({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mt-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full flex-1 transition-colors ${
            i < current ? 'bg-primary' : i === current ? 'bg-primary/40' : 'bg-border'
          }`}
        />
      ))}
    </div>
  )
}

function buildSystemPrompt(scenario: Scenario, familiarity: string, extraContext: string, trustedPerson?: TrustedPerson | null) {
  let prompt = `You are playing the role of ${scenario.persona} in a practice conversation via ${scenario.medium || 'text message'}.
The situation: "${scenario.situation}"
The user knows you: ${familiarity}.`
  if (extraContext) prompt += ` Additional context: ${extraContext}`
  if (trustedPerson?.communication_style) {
    prompt += `\n\nCommunication style notes for this person: ${trustedPerson.communication_style}`
    if (trustedPerson.notes) prompt += ` ${trustedPerson.notes}`
  }
  prompt += `\n\nStay in character. Respond realistically — including natural resistance, questions, or reactions. Difficulty level: ${scenario.difficulty}.`
  return prompt
}

export default function SkillModulePage() {
  const supabase = createClient()
  const { id } = useParams() as { id: string }
  const skillModule = SKILL_MODULES.find(m => m.id === id)

  const [phase, setPhase] = useState<Phase>('tips')
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [familiarity, setFamiliarity] = useState<'not much' | 'a bit' | 'well'>('a bit')
  const [extraContext, setExtraContext] = useState('')
  const [trustedPeople, setTrustedPeople] = useState<TrustedPerson[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState('')

  // Steps phase
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [stepMessages, setStepMessages] = useState<Message[]>([])
  const [pickedOptionIndex, setPickedOptionIndex] = useState<number | null>(null)
  const [stepLoading, setStepLoading] = useState(false)
  const [aiStepMessage, setAiStepMessage] = useState<string>('')

  // Practice phase
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [debrief, setDebrief] = useState<DebriefData | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    async function loadTP() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('trusted_people')
          .select('id, name, relationship, communication_style, notes')
          .eq('user_id', user.id)
          .order('name')
        setTrustedPeople((data as TrustedPerson[]) || [])
      } catch { /* table may not exist */ }
    }
    loadTP()
  }, [])

  if (!skillModule) {
    return (
      <div className="max-w-lg">
        <Link href="/dashboard/skills" className="text-sm text-ink-mid hover:text-ink mb-8 inline-block">← Skills</Link>
        <p className="text-ink-mid">Module not found.</p>
      </div>
    )
  }

  const scenario = skillModule.scenarios[scenarioIndex]
  const textScenarios = skillModule.scenarios.filter(s => s.format === 'text')
  const selectedTrustedPerson = trustedPeople.find(p => p.id === selectedPersonId) || null

  // Progress calculation
  const steps = scenario.format === 'text' ? (scenario.steps || []) : []
  const totalSlides = 2 + steps.length + 2 // tips + context + steps + practice + debrief
  const currentSlide =
    phase === 'tips' ? 0
    : phase === 'context' ? 1
    : phase === 'steps' ? 2 + currentStepIndex
    : phase === 'practice' ? 2 + steps.length
    : 2 + steps.length + 1

  async function callAPI(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch('/api/practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await res.json() as Record<string, unknown>
  }

  // ── Context slide → enter steps/practice ──────────────────────────────────

  async function startPractice() {
    if (scenario.format === 'in-person') {
      setPhase('practice')
      return
    }
    if (!steps.length) {
      setPhase('practice')
      return
    }

    setPhase('steps')
    setCurrentStepIndex(0)
    setStepMessages([])
    setPickedOptionIndex(null)

    const step0 = steps[0]
    if (step0.aiSeed) {
      setAiStepMessage(step0.aiSeed)
    } else {
      setStepLoading(true)
      const system = buildSystemPrompt(scenario, familiarity, extraContext, selectedTrustedPerson)
      const data = await callAPI({ action: 'turn', system, messages: [{ role: 'user', content: '(start the conversation — send the first message as this person would)' }] })
      setStepLoading(false)
      setAiStepMessage((data.text as string) || '')
    }
  }

  // ── Steps: user picks an option ───────────────────────────────────────────

  async function pickOption(optionIndex: number) {
    if (pickedOptionIndex !== null || stepLoading) return
    setPickedOptionIndex(optionIndex)
    const step = steps[currentStepIndex]
    const chosen = step.options[optionIndex]

    const userMsg: Message = { role: 'user', content: chosen.text }
    const aiMsg: Message = { role: 'assistant', content: aiStepMessage }
    const newHistory = [...stepMessages, aiMsg, userMsg]
    setStepMessages(newHistory)
  }

  async function continueToNextStep() {
    if (currentStepIndex >= steps.length - 1) {
      // Done with steps — move to open practice, seeded with history
      setMessages(stepMessages)
      setPhase('practice')
      return
    }

    const nextIndex = currentStepIndex + 1
    setCurrentStepIndex(nextIndex)
    setPickedOptionIndex(null)
    setStepLoading(true)

    const system = buildSystemPrompt(scenario, familiarity, extraContext, selectedTrustedPerson)
    const data = await callAPI({ action: 'turn', system, messages: stepMessages })
    setStepLoading(false)
    setAiStepMessage((data.text as string) || '')
  }

  // ── Practice: open conversation ───────────────────────────────────────────

  async function startOpenPractice() {
    setLoading(true)
    const system = buildSystemPrompt(scenario, familiarity, extraContext, selectedTrustedPerson)
    const seed: Message[] = [{ role: 'user', content: '(start — greet me or react naturally as this person would)' }]
    const data = await callAPI({ action: 'turn', system, messages: seed })
    setLoading(false)
    if (data.text) setMessages([{ role: 'assistant', content: data.text as string }])
  }

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    const system = buildSystemPrompt(scenario, familiarity, extraContext, selectedTrustedPerson)
    const data = await callAPI({ action: 'turn', system, messages: next })
    setLoading(false)
    if (data.text) setMessages(prev => [...prev, { role: 'assistant', content: data.text as string }])
    else if (data.error) setError(data.error as string)
  }

  async function endAndDebrief() {
    setLoading(true)
    const history = messages.map(m => `[${m.role === 'user' ? 'You' : scenario.persona}]: ${m.content}`).join('\n')
    const data = await callAPI({
      action: 'debrief',
      personDescription: scenario.persona,
      situation: scenario.situation,
      goal: skillModule!.description,
      conversationHistory: history,
    })
    setLoading(false)
    if (data.error) { setError(data.error as string); return }
    setDebrief(data as DebriefData)
    setPhase('debrief')
  }

  // ── Tips slide ─────────────────────────────────────────────────────────────

  if (phase === 'tips') {
    return (
      <div className="max-w-lg">
        <Link href="/dashboard/skills" className="text-sm text-ink-mid hover:text-ink mb-6 inline-block">← Skills</Link>
        <h1 className="text-3xl text-ink mb-2" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          {skillModule.title}
        </h1>
        <p className="text-ink-mid text-sm mb-8">{skillModule.description}</p>

        <div className="bg-white border border-border rounded-card p-6 mb-6">
          <p className="text-xs font-medium text-ink-light uppercase tracking-wide mb-4">Things to remember</p>
          <ul className="space-y-3">
            {skillModule.tips.map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm text-ink leading-relaxed">
                <span className="text-primary mt-0.5 shrink-0">·</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => setPhase('context')}
          className="w-full bg-primary text-white rounded-pill py-3 text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          Next →
        </button>
        <ProgressMeter current={currentSlide} total={totalSlides} />
      </div>
    )
  }

  // ── Context slide ──────────────────────────────────────────────────────────

  if (phase === 'context') {
    const difficultyColor: Record<string, string> = {
      low: 'bg-green-50 text-green-700',
      medium: 'bg-amber-50 text-amber-700',
      high: 'bg-red-50 text-red-700',
    }
    const difficultyLabel: Record<string, string> = { low: 'Beginner', medium: 'Intermediate', high: 'Advanced' }

    return (
      <div className="max-w-lg">
        <button onClick={() => setPhase('tips')} className="text-sm text-ink-mid hover:text-ink mb-6 inline-block">← Back</button>

        <h2 className="text-xl text-ink mb-6" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Set the scene
        </h2>

        {/* Scenario info */}
        <div className="bg-white border border-border rounded-card p-5 mb-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              {scenario.medium && (
                <span className="text-xs font-medium bg-primary-light text-primary rounded-pill px-2 py-0.5 mr-2">
                  {scenario.medium}
                </span>
              )}
              {scenario.format === 'in-person' && (
                <span className="text-xs font-medium bg-ink-light/20 text-ink-mid rounded-pill px-2 py-0.5">
                  Video coming soon
                </span>
              )}
            </div>
            <span className={`text-xs rounded-pill px-2 py-0.5 shrink-0 ${difficultyColor[scenario.difficulty]}`}>
              {difficultyLabel[scenario.difficulty]}
            </span>
          </div>
          <p className="text-sm font-medium text-ink mb-1">With: {scenario.persona}</p>
          <p className="text-sm text-ink-mid">{scenario.situation}</p>
        </div>

        {scenario.format !== 'in-person' && (
          <>
            {/* Familiarity */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-ink mb-2">How well do you know this person?</label>
              <div className="flex gap-2">
                {(['not much', 'a bit', 'well'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFamiliarity(f)}
                    className={`flex-1 py-2 text-sm rounded-pill border transition-colors ${
                      familiarity === f
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-ink-mid hover:border-primary hover:text-ink'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra context */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-ink mb-1">
                Any additional context?{' '}
                <span className="font-normal text-ink-light">(optional)</span>
              </label>
              <textarea
                value={extraContext}
                onChange={e => setExtraContext(e.target.value)}
                placeholder="e.g. We have been working together for 2 years. There is some tension lately around project credit."
                rows={2}
                className="w-full border border-border rounded-sm px-3 py-2.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            {/* Trusted People */}
            {trustedPeople.length > 0 && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-ink mb-1">
                  Is this someone from your Trusted People?{' '}
                  <span className="font-normal text-ink-light">(optional)</span>
                </label>
                <select
                  value={selectedPersonId}
                  onChange={e => setSelectedPersonId(e.target.value)}
                  className="w-full border border-border rounded-sm px-3 py-2.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">None</option>
                  {trustedPeople.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.relationship ? ` — ${p.relationship}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {scenario.format === 'in-person' ? (
          <div className="bg-bg border border-border rounded-card p-5 text-center mb-4">
            <p className="text-sm text-ink-mid">This scenario happens face to face. A video practice mode is coming soon.</p>
            {textScenarios.length > 0 && (
              <button
                onClick={() => {
                  const idx = skillModule.scenarios.findIndex(s => s.format === 'text')
                  if (idx >= 0) { setScenarioIndex(idx); setPhase('context') }
                }}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Switch to a text-based scenario →
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={startPractice}
            className="w-full bg-primary text-white rounded-pill py-3 text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            Start practice →
          </button>
        )}

        <ProgressMeter current={currentSlide} total={totalSlides} />
      </div>
    )
  }

  // ── Steps slide ────────────────────────────────────────────────────────────

  if (phase === 'steps') {
    const step = steps[currentStepIndex]
    const picked = pickedOptionIndex !== null ? step.options[pickedOptionIndex] : null

    return (
      <div className="max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-medium text-ink">{skillModule.title}</h2>
            <p className="text-xs text-ink-light">{scenario.medium} · Step {currentStepIndex + 1} of {steps.length}</p>
          </div>
          {scenario.medium && (
            <span className="text-xs bg-primary-light text-primary rounded-pill px-2.5 py-1">{scenario.medium}</span>
          )}
        </div>

        {step.label && (
          <p className="text-xs text-ink-light mb-3">{step.label}</p>
        )}

        {/* AI message */}
        {stepLoading ? (
          <div className="bg-white border border-border rounded-card p-4 mb-6">
            <div className="flex gap-1 items-center h-4">
              <span className="w-1.5 h-1.5 bg-ink-light rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-ink-light rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-ink-light rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : aiStepMessage ? (
          <div className="bg-white border border-border rounded-card p-4 mb-6">
            <p className="text-xs font-medium text-ink-light mb-2">{scenario.persona}</p>
            <p className="text-sm text-ink leading-relaxed">{aiStepMessage}</p>
          </div>
        ) : null}

        {/* Options */}
        {!stepLoading && (
          <div className="space-y-3 mb-4">
            <p className="text-xs font-medium text-ink-light uppercase tracking-wide">How do you respond?</p>
            {step.options.map((opt, i) => {
              const isPicked = pickedOptionIndex === i
              return (
                <div key={i}>
                  <button
                    onClick={() => pickOption(i)}
                    disabled={pickedOptionIndex !== null}
                    className={`w-full text-left border rounded-card p-4 text-sm transition-colors ${
                      isPicked
                        ? `${qualityStyle[opt.quality]} border-2`
                        : pickedOptionIndex !== null
                        ? 'border-border text-ink-light bg-white opacity-50 cursor-not-allowed'
                        : 'border-border bg-white hover:border-primary text-ink'
                    }`}
                  >
                    {opt.text}
                  </button>
                  {isPicked && (
                    <div className={`mt-2 rounded-sm p-3 border ${qualityStyle[opt.quality]}`}>
                      <p className={`text-xs font-medium mb-1 ${qualityText[opt.quality]}`}>
                        {qualityLabel[opt.quality]}
                      </p>
                      <p className="text-xs text-ink-mid">{opt.note}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {picked && (
          <button
            onClick={continueToNextStep}
            disabled={stepLoading}
            className="w-full bg-primary text-white rounded-pill py-3 text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {currentStepIndex >= steps.length - 1 ? 'Move to open practice →' : 'Continue →'}
          </button>
        )}

        <ProgressMeter current={currentSlide} total={totalSlides} />
      </div>
    )
  }

  // ── Practice slide (open conversation) ────────────────────────────────────

  if (phase === 'practice') {
    const hasSeedMessages = messages.length > 0

    return (
      <div className="max-w-lg flex flex-col" style={{ height: 'calc(100vh - 96px)' }}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-base font-medium text-ink">{skillModule.title}</h2>
            <p className="text-xs text-ink-light">{scenario.persona}</p>
          </div>
          <button
            onClick={endAndDebrief}
            disabled={loading || messages.length < 2}
            className="text-xs text-primary border border-primary rounded-pill px-3 py-1.5 hover:bg-primary-light transition-colors disabled:opacity-40"
          >
            End + get feedback
          </button>
        </div>

        {!hasSeedMessages && (
          <div className="bg-bg border border-border rounded-card p-5 mb-4 text-center shrink-0">
            <p className="text-sm text-ink-mid mb-3">
              Open practice — you are in charge now. Start however feels natural.
            </p>
            <button
              onClick={startOpenPractice}
              disabled={loading}
              className="bg-primary text-white text-sm rounded-pill px-5 py-2 hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Starting…' : 'Let them go first'}
            </button>
          </div>
        )}

        {error && <p className="text-red-600 text-sm mb-3 shrink-0">{error}</p>}

        <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-white border border-border text-ink rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-border rounded-2xl rounded-bl-sm px-4 py-2.5">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-ink-light rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-ink-light rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-ink-light rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 shrink-0">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
            placeholder="Your turn…"
            disabled={loading}
            className="flex-1 border border-border rounded-pill px-4 py-2.5 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-primary text-white rounded-pill px-5 py-2.5 text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    )
  }

  // ── Debrief ────────────────────────────────────────────────────────────────

  const hasHarder = scenarioIndex < skillModule.scenarios.length - 1

  return (
    <div className="max-w-lg">
      <h1 className="text-3xl text-ink mb-2" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
        How did it go?
      </h1>
      <p className="text-ink-mid text-sm mb-8">Beckett&apos;s feedback on your practice.</p>

      {loading && <p className="text-ink-mid text-sm">Generating feedback…</p>}

      {!loading && debrief && (
        <div className="space-y-4">
          {[
            { label: 'How they likely felt', value: debrief.other_person_felt },
            { label: 'How you came across', value: debrief.how_you_came_across },
            { label: 'What went well', value: debrief.what_went_well },
            { label: 'Things to work on', value: debrief.things_to_work_on },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-border rounded-card p-5">
              <p className="text-xs font-medium text-ink-light uppercase tracking-wide mb-2">{label}</p>
              <p className="text-sm text-ink leading-relaxed">{value}</p>
            </div>
          ))}

          <div className="flex flex-col gap-3 pt-2">
            {hasHarder && (
              <button
                onClick={() => {
                  setScenarioIndex(i => i + 1)
                  setPhase('tips')
                  setMessages([])
                  setStepMessages([])
                  setDebrief(null)
                  setCurrentStepIndex(0)
                  setPickedOptionIndex(null)
                }}
                className="w-full bg-primary text-white rounded-pill py-3 text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                Try the next scenario →
              </button>
            )}
            <button
              onClick={() => { setPhase('tips'); setMessages([]); setStepMessages([]); setDebrief(null); setCurrentStepIndex(0); setPickedOptionIndex(null) }}
              className="w-full border border-border rounded-pill py-3 text-sm font-medium text-ink hover:bg-primary-light transition-colors"
            >
              Try again
            </button>
            <Link
              href="/dashboard/skills"
              className="w-full border border-border rounded-pill py-3 text-sm font-medium text-ink text-center hover:bg-primary-light transition-colors"
            >
              ← Back to skills
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
