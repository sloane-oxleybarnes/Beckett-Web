'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { AdaptiveAssessment, AdaptiveNudge, AdaptiveTranscriptItem } from '@/lib/adaptive-conversation'

type Message = AdaptiveTranscriptItem
type Assessment = AdaptiveAssessment

export function displayPersonName(value: string) {
  const cleaned = value.trim()
  if (!cleaned) return cleaned
  const withoutParenthetical = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return withoutParenthetical.split(/[,;]|\s+[–—]\s+|\s+-\s+/)[0]?.trim() || cleaned
}

export function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block text-sm font-medium">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 block w-full rounded-card border border-border px-3 py-3 text-sm font-normal outline-none focus:border-primary" /></label> }
export function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="mt-5 block text-sm font-medium">{label}<textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} className="mt-2 block w-full resize-none rounded-card border border-border px-3 py-3 text-sm font-normal outline-none focus:border-primary" /></label> }
export function ReviewRow({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium uppercase tracking-wide text-ink-light">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{value}</p></div> }
export function AssessmentViewLegacy({ assessment, onNew, onReplay }: { assessment: Assessment; onNew: () => void; onReplay: () => void }) { return <section className="mx-auto max-w-3xl"><div className="rounded-card border border-border bg-white p-6 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-primary">Conversation assessment</p><h2 className="mt-1 text-3xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>What this conversation showed</h2><p className="mt-4 text-sm leading-6 text-ink">{assessment.summary}</p><AssessmentList title="What worked" items={assessment.whatWorked} /><AssessmentList title="Turning points" items={assessment.turningPoints} /><div className="mt-6 grid gap-5 sm:grid-cols-2"><AssessmentList title="What increased resistance" items={assessment.resistance?.increased || []} /><AssessmentList title="What reduced resistance" items={assessment.resistance?.reduced || []} /></div><div className="mt-6 rounded-card bg-primary-light/40 p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">A stronger response</p><p className="mt-2 text-sm leading-6 text-ink">{(assessment as Assessment & { strongerResponse?: string }).strongerResponse || 'Review the turning points and replay a moment that would be useful to try again.'}</p></div><div className="mt-5"><p className="text-xs font-medium uppercase tracking-wide text-ink-light">Progress toward your goal</p><p className="mt-2 text-sm leading-6 text-ink">{assessment.goalProgress}</p></div>{assessment.replayPoint && <div className="mt-5 rounded-card border border-border p-4"><p className="text-xs font-medium uppercase tracking-wide text-ink-light">A moment worth revisiting · exchange {assessment.replayPoint.turn}</p><p className="mt-2 text-sm leading-6 text-ink">{assessment.replayPoint.why}</p><button onClick={onReplay} className="mt-4 rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white">Replay this turning point →</button></div>}<button onClick={onNew} className="mt-7 rounded-pill border border-border px-5 py-3 text-sm font-medium text-ink">Start a new simulation</button></div></section> }

export function AssessmentViewUpdated({ assessment, canReplay, onNew, onReplay }: { assessment: Assessment; canReplay: boolean; onNew: () => void; onReplay: () => void }) {
  return <section className="mx-auto max-w-3xl"><div className="rounded-card border border-border bg-white p-6 shadow-sm"><p className="text-xs font-medium uppercase tracking-wide text-primary">Conversation assessment</p><h2 className="mt-1 text-3xl" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>What this conversation showed</h2><p className="mt-4 text-sm leading-6 text-ink">{assessment.summary}</p><AssessmentList title="What worked" items={assessment.whatWorked} /><div className="mt-6 grid gap-5 sm:grid-cols-2"><AssessmentList title="What increased resistance" items={assessment.resistance?.increased || []} /><AssessmentList title="What reduced resistance" items={assessment.resistance?.reduced || []} /></div><div className="mt-5"><p className="text-xs font-medium uppercase tracking-wide text-ink-light">Progress toward your goal</p><p className="mt-2 text-sm leading-6 text-ink">{assessment.goalProgress}</p></div><TurningPointList items={assessment.turningPoints} />{canReplay && assessment.replayPoint && <div className="mt-5 rounded-card border border-border p-4"><p className="text-xs font-medium uppercase tracking-wide text-ink-light">A moment worth revisiting</p><p className="mt-2 text-sm leading-6 text-ink">{assessment.replayPoint.why}</p><button onClick={onReplay} className="mt-4 rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white">Replay this turning point →</button></div>}<button onClick={onNew} className="mt-7 rounded-pill border border-border px-5 py-3 text-sm font-medium text-ink">Start a new simulation</button></div></section>
}

function TurningPointList({ items }: { items: Assessment['turningPoints'] }) { const topThree = items.slice(0, 3); return <div className="mt-6"><p className="text-xs font-medium uppercase tracking-wide text-ink-light">Top turning points</p><div className="mt-3 space-y-3">{topThree.length ? topThree.map((item, index) => typeof item === 'string' ? <p key={`${item}-${index}`} className="text-sm leading-6 text-ink">{item}</p> : <div key={`${item.turn}-${index}`} className="rounded-card border border-border bg-[#FBF8F3] p-4"><p className="text-xs font-medium uppercase tracking-wide text-primary">Exchange {item.turn}</p><p className="mt-2 text-sm leading-6"><span className="font-medium">You:</span> “{item.userSaid}”</p><p className="mt-1 text-sm leading-6"><span className="font-medium">The other person:</span> “{item.personSaid}”</p><p className="mt-2 text-sm leading-6 text-ink-mid">{item.why}</p></div>) : <p className="text-sm text-ink-light">Nothing notable here.</p>}</div></div> }
function AssessmentList({ title, items }: { title: string; items: Array<string | { why?: string }> }) { const firstFour = items.slice(0, 4); return <div className="mt-6"><p className="text-xs font-medium uppercase tracking-wide text-ink-light">{title}</p>{firstFour.length ? <ul className="mt-2 space-y-2 text-sm leading-6 text-ink">{firstFour.map((item, index) => <li key={`${typeof item === 'string' ? item : item.why || index}-${index}`} className="flex gap-2"><span className="text-primary">•</span><span>{typeof item === 'string' ? item : item.why}</span></li>)}</ul> : <p className="mt-2 text-sm text-ink-light">Nothing notable here.</p>}</div> }
type SpeechResultEvent = { results: ArrayLike<{ 0: { transcript: string } }> }
type SpeechRecognizer = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((event: SpeechResultEvent) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
type BrowserSpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer }

export function VideoCallFrame({ sessionId, person, messages, typing, speaking, audioError, input, setInput, onSubmit, onVoiceTranscript, onTranscriptSync, onSupervisorUpdate, onSpeakingChange, onEnd, onPause, paused, disabled, channel }: { sessionId: string | null; person: string; messages: Message[]; typing: boolean; speaking: boolean; audioError: string; input: string; setInput: (value: string) => void; onSubmit: (event: FormEvent) => void; onVoiceTranscript: (role: 'user' | 'simulated_person', content: string) => Promise<void>; onTranscriptSync: (messages: Message[]) => void; onSupervisorUpdate: (nudge: AdaptiveNudge) => void; onSpeakingChange: (value: boolean) => void; onEnd: (transcript?: Message[]) => void | Promise<void>; onPause: () => void; paused: boolean; disabled: boolean; channel: 'phone' | 'video' }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [callConnected, setCallConnected] = useState(false)
  const [callBusy, setCallBusy] = useState(false)
  const [avatarEmbedUrl, setAvatarEmbedUrl] = useState('')
  const [avatarEmbedId, setAvatarEmbedId] = useState('')
  const [avatarEmbedBusy, setAvatarEmbedBusy] = useState(false)
  const [avatarEnding, setAvatarEnding] = useState(false)
  const [avatarEmbedError, setAvatarEmbedError] = useState('')
  const [avatarContextId, setAvatarContextId] = useState('')
  const avatarContextIdRef = useRef('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [ringing, setRinging] = useState(false)
  const [liveCaption, setLiveCaption] = useState('')
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const recognitionRef = useRef<SpeechRecognizer | null>(null)
  const savedVoiceTranscriptRef = useRef({ user: '', simulated_person: '' })
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const supervisedFingerprintRef = useRef('')
  const openingResponseSentRef = useRef(false)
  const responsePendingRef = useRef(false)
  const pendingTranscriptRef = useRef<Promise<void>[]>([])
  const captionTargetRef = useRef('')
  const captionShownRef = useRef('')
  const captionTimerRef = useRef<number | null>(null)
  const captionResponseStartedRef = useRef(false)

  function stopCaptionPlayback() {
    if (captionTimerRef.current !== null) {
      window.clearInterval(captionTimerRef.current)
      captionTimerRef.current = null
    }
  }

  function resetCaptionPlayback() {
    stopCaptionPlayback()
    captionTargetRef.current = ''
    captionShownRef.current = ''
    setLiveCaption('')
  }

  function queueCaptionText(text: string) {
    if (!text) return
    captionTargetRef.current = text
    if (captionTimerRef.current !== null) return
    // Transcript deltas can arrive before the audio reaches the user. Reveal
    // captions at roughly spoken pace so the user cannot read ahead.
    captionTimerRef.current = window.setInterval(() => {
      const target = captionTargetRef.current
      const shown = captionShownRef.current
      if (shown.length >= target.length) {
        stopCaptionPlayback()
        return
      }
      const next = target.slice(0, shown.length + 1)
      captionShownRef.current = next
      setLiveCaption(next)
    }, 45)
  }

  function queueVoiceTranscript(role: 'user' | 'simulated_person', content: string) {
    const pending = onVoiceTranscript(role, content)
    pendingTranscriptRef.current.push(pending)
    void pending.finally(() => {
      pendingTranscriptRef.current = pendingTranscriptRef.current.filter((item) => item !== pending)
    }).catch(() => undefined)
  }

  async function startSandboxAvatar() {
    if (!sessionId || avatarEmbedBusy || avatarEmbedUrl) return
    setAvatarEmbedBusy(true)
    setAvatarEmbedError('')
    try {
      const response = await fetch(`/api/labs/adaptive-conversation/${sessionId}/liveavatar`, { method: 'POST' })
      const body = await response.json().catch(() => null) as { url?: string; embedId?: string | null; contextId?: string | null; personalized?: boolean; warning?: string; error?: string } | null
      if (!response.ok || !body?.url) throw new Error(body?.error || 'LiveAvatar sandbox could not be started.')
      setAvatarEmbedUrl(body.url)
      setAvatarEmbedId(body.embedId || '')
      setAvatarContextId(body.contextId || '')
      avatarContextIdRef.current = body.contextId || ''
      if (body.warning) setAvatarEmbedError(body.warning)
      setCallConnected(true)
    } catch (error) {
      setAvatarEmbedError(error instanceof Error ? error.message : 'LiveAvatar sandbox could not be started.')
    } finally {
      setAvatarEmbedBusy(false)
    }
  }

  async function stopAvatarSession(showError = true) {
    const contextId = avatarContextId
    const embedId = avatarEmbedId
    setAvatarEmbedUrl('')
    setAvatarEmbedId('')
    avatarContextIdRef.current = ''
    setAvatarContextId('')
    setCallConnected(false)
    let transcript = messages
    if (!sessionId || (!contextId && !embedId)) return transcript
    const response = await fetch(`/api/labs/adaptive-conversation/${sessionId}/liveavatar`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextId, embedId }),
    }).catch(() => null)
    const body = await response?.json().catch(() => null) as { transcript?: Message[]; error?: string } | null
    if (Array.isArray(body?.transcript) && body.transcript.length) {
      transcript = body.transcript
      onTranscriptSync(transcript)
    }
    if (showError && body?.error && !body.transcript?.length) setAvatarEmbedError(body.error)
    return transcript
  }

  async function endSandboxAvatar() {
    if (!sessionId || avatarEnding) return
    setAvatarEnding(true)
    const transcript = await stopAvatarSession()
    await onEnd(transcript)
    setAvatarEnding(false)
  }

  async function switchToAudioFallback() {
    if (avatarEnding || callBusy) return
    setAvatarEnding(true)
    await stopAvatarSession(false)
    setAvatarEnding(false)
    await startLiveCall(false)
  }

  async function endLiveCall() {
    setCallConnected(false)
    setCallBusy(false)
    setRinging(false)
    onSpeakingChange(false)
    dataChannelRef.current?.close()
    dataChannelRef.current = null
    peerRef.current?.close()
    peerRef.current = null
    recognitionRef.current?.stop()
    resetCaptionPlayback()
    if (audioRef.current) audioRef.current.srcObject = null
    await Promise.allSettled(pendingTranscriptRef.current)
    let transcript = messages
    if (sessionId) {
      const response = await fetch(`/api/labs/adaptive-conversation/${sessionId}`).catch(() => null)
      const body = await response?.json().catch(() => null) as { session?: { transcript?: Message[] } } | null
      if (Array.isArray(body?.session?.transcript) && body.session.transcript.length >= transcript.length) transcript = body.session.transcript
    }
    await onEnd(transcript)
  }

  async function enableMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraOn(true)
      setMicOn(true)
      setMediaError('')
    } catch { setMediaError('Camera or microphone permission was unavailable. You can continue with the text fallback.') }
  }

  const requestLiveSupervision = useCallback(async () => {
    if (!sessionId) return
    const response = await fetch(`/api/labs/adaptive-conversation/${sessionId}/supervise`, { method: 'POST' }).catch(() => null)
    if (!response?.ok) return
    const body = await response.json().catch(() => null) as { shouldNudge?: boolean; prompt?: string; examples?: string[]; instructions?: string } | null
    if (body?.shouldNudge && body.prompt) onSupervisorUpdate({ shouldNudge: true, prompt: body.prompt, examples: body.examples || [] })
    if (body?.instructions && dataChannelRef.current?.readyState === 'open' && (String(channel) === 'phone' || !avatarEmbedUrl)) {
      dataChannelRef.current.send(JSON.stringify({ type: 'session.update', session: { instructions: body.instructions } }))
    }
  }, [avatarEmbedUrl, channel, onSupervisorUpdate, sessionId])

  async function startLiveCall(audioOnly = false) {
    if (!sessionId || callBusy || callConnected) return
    setCallBusy(true)
    setRinging(String(channel) === 'phone')
    setMediaError('')
    resetCaptionPlayback()
    captionResponseStartedRef.current = false
    openingResponseSentRef.current = false
    responsePendingRef.current = false
    try {
      if (String(channel) === 'phone') {
        const audioContext = new AudioContext()
        for (let index = 0; index < 2; index += 1) {
          const startAt = audioContext.currentTime + index * 0.7
          const oscillator = audioContext.createOscillator()
          const secondOscillator = audioContext.createOscillator()
          const gain = audioContext.createGain()
          oscillator.frequency.value = 440
          secondOscillator.frequency.value = 480
          gain.gain.setValueAtTime(0.0001, startAt)
          gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.03)
          gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.35)
          oscillator.connect(gain)
          secondOscillator.connect(gain)
          gain.connect(audioContext.destination)
          oscillator.start(startAt)
          secondOscillator.start(startAt)
          oscillator.stop(startAt + 0.4)
          secondOscillator.stop(startAt + 0.4)
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1500))
        await audioContext.close()
      }
      const stream = streamRef.current || await navigator.mediaDevices.getUserMedia({ video: !audioOnly && channel === 'video', audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      streamRef.current = stream
      if (videoRef.current && channel === 'video') videoRef.current.srcObject = stream
      const peer = new RTCPeerConnection()
      peerRef.current = peer
      peer.ontrack = (event) => { if (audioRef.current) audioRef.current.srcObject = event.streams[0] }
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) peer.addTrack(audioTrack, stream)
      const events = peer.createDataChannel('oai-events')
      dataChannelRef.current = events
      events.onopen = () => {
        if (openingResponseSentRef.current) return
        openingResponseSentRef.current = true
        responsePendingRef.current = true
        events.send(JSON.stringify({ type: 'response.create', response: { instructions: channel === 'phone' ? 'Give one brief, casual hello first, such as "Hey, what\'s up?" Do not mention the setup or guess what the user wants yet.' : undefined } }))
        setCallConnected(true)
      }
      events.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { type?: string; delta?: string; transcript?: string }
          if (payload.type === 'response.done') { responsePendingRef.current = false; onSpeakingChange(false) }
          if (payload.type === 'input_audio_buffer.speech_stopped') captionResponseStartedRef.current = false
          if (payload.type === 'input_audio_buffer.speech_stopped' && !responsePendingRef.current && events.readyState === 'open') {
            responsePendingRef.current = true
            events.send(JSON.stringify({ type: 'response.create' }))
          }
          if (payload.type === 'response.output_audio_transcript.delta' && payload.delta) {
            if (!captionResponseStartedRef.current) {
              resetCaptionPlayback()
              captionResponseStartedRef.current = true
            }
            onSpeakingChange(true)
            queueCaptionText(payload.delta)
          }
          if (payload.type === 'conversation.item.input_audio_transcription.completed' && payload.transcript && savedVoiceTranscriptRef.current.user !== payload.transcript) { savedVoiceTranscriptRef.current.user = payload.transcript; queueVoiceTranscript('user', payload.transcript) }
          if (payload.type === 'response.output_audio_transcript.done' && payload.transcript && savedVoiceTranscriptRef.current.simulated_person !== payload.transcript) {
            if (!captionResponseStartedRef.current) {
              resetCaptionPlayback()
              captionResponseStartedRef.current = true
            }
            savedVoiceTranscriptRef.current.simulated_person = payload.transcript
            queueCaptionText(payload.transcript)
            void (async () => { queueVoiceTranscript('simulated_person', payload.transcript || ''); await requestLiveSupervision() })()
          }
        } catch { /* Ignore non-JSON WebRTC events. */ }
      }
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      const response = await fetch(`/api/labs/adaptive-conversation/${sessionId}/realtime`, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: offer.sdp })
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Realtime voice session could not start.')
      await peer.setRemoteDescription({ type: 'answer', sdp: await response.text() })
      setCameraOn(!audioOnly && channel === 'video' && Boolean(stream.getVideoTracks().length))
      setMicOn(true)
    } catch (error) {
      peerRef.current?.close()
      setCallConnected(false)
      setMediaError(error instanceof Error ? error.message : 'Realtime voice could not start. Use the text fallback.')
    } finally { setCallBusy(false); setRinging(false) }
  }

  function toggleCamera() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setCameraOn(track.enabled)
  }

  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMicOn(track.enabled)
  }

  function captureSpeech() {
    const browserWindow = window as BrowserSpeechWindow
    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition
    if (!SpeechRecognition) { setMediaError('Live speech recognition is unavailable in this browser. Use the text fallback below.'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.onresult = (event: SpeechResultEvent) => setInput(Array.from(event.results).map((result) => result[0].transcript).join(' '))
    recognition.onerror = () => setMediaError('Microphone transcription failed. Use the text fallback below.')
    recognition.onend = () => setMicOn(Boolean(streamRef.current?.getAudioTracks()[0]?.enabled))
    recognitionRef.current = recognition
    setMicOn(true)
    recognition.start()
  }

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream || String(channel) !== 'video' || !cameraOn) return
    if (video.srcObject !== stream) video.srcObject = stream
    void video.play().catch(() => undefined)
  }, [cameraOn, channel])

  useEffect(() => () => {
    const contextId = avatarContextIdRef.current
    if (String(channel) === 'video' && sessionId && contextId) {
      void fetch(`/api/labs/adaptive-conversation/${sessionId}/liveavatar`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextId, embedId: avatarEmbedId }),
        keepalive: true,
      }).catch(() => undefined)
    }
    peerRef.current?.close()
    dataChannelRef.current = null
    stopCaptionPlayback()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    recognitionRef.current?.stop()
  }, [channel, sessionId, avatarEmbedId])
  useEffect(() => {
    if (String(channel) !== 'video' || !sessionId || !avatarEmbedId || !avatarEmbedUrl) return
    let cancelled = false
    const syncTranscript = async () => {
      const response = await fetch(`/api/labs/adaptive-conversation/${sessionId}/liveavatar?embedId=${encodeURIComponent(avatarEmbedId)}`)
      if (!response.ok || cancelled) return
      const body = await response.json().catch(() => null) as { transcript?: Message[] } | null
      if (!cancelled && Array.isArray(body?.transcript) && body.transcript.length) {
        onTranscriptSync(body.transcript)
        const fingerprint = body.transcript.map((message) => `${message.role}:${message.content}`).join('|')
        const latestMessage = body.transcript[body.transcript.length - 1]
        if (latestMessage?.role === 'simulated_person' && fingerprint !== supervisedFingerprintRef.current) {
          supervisedFingerprintRef.current = fingerprint
          void requestLiveSupervision()
        }
      }
    }
    void syncTranscript()
    const interval = window.setInterval(() => { void syncTranscript() }, 3500)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [avatarEmbedId, avatarEmbedUrl, channel, onTranscriptSync, requestLiveSupervision, sessionId])
  const latest = [...messages].reverse().find((message) => message.role === 'simulated_person')
  if (String(channel) === 'phone') return <PhoneCallFrameCompact audioRef={audioRef} person={person} connected={callConnected} ringing={ringing} connecting={callBusy} paused={paused} caption={liveCaption} error={mediaError || audioError} input={input} setInput={setInput} onStart={startLiveCall} onPause={() => { toggleMic(); onPause() }} onEnd={endLiveCall} onSubmit={onSubmit} disabled={disabled} />
  return <section className="mx-auto mb-5 max-w-4xl rounded-[2rem] border border-border bg-[#17202B] p-4 text-white shadow-sm sm:p-5"><audio ref={audioRef} autoPlay /><div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">Video practice</p><h2 className="mt-1 text-xl sm:text-2xl">Conversation with {person}</h2></div><span className={`shrink-0 rounded-pill px-3 py-1 text-xs ${speaking || typing ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/70'}`}>{speaking ? 'Speaking' : typing ? 'Listening…' : callConnected ? 'Live' : 'Ready'}</span></div><div className="relative mt-4 aspect-video overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#34495D] via-[#1F2D3B] to-[#101820]">{avatarEmbedUrl ? <iframe src={avatarEmbedUrl} title={`${person} LiveAvatar sandbox`} allow="autoplay; microphone; camera; fullscreen" allowFullScreen onError={() => setAvatarEmbedError('LiveAvatar could not load. Use the Beckett video call to continue.')} className="absolute inset-0 h-full w-full border-0" /> : <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"><div className="absolute left-5 top-5 rounded-pill bg-black/25 px-3 py-1 text-xs text-white/75">{person} · simulated person</div><div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/25 bg-white/10 text-5xl">{person.trim().charAt(0).toUpperCase() || 'B'}</div><p className="mt-5 text-lg text-white/85">{callConnected ? 'Conversation live. Speak naturally.' : 'Ready when you are.'}</p>{!callConnected && <button type="button" onClick={() => { void startLiveCall(false) }} disabled={callBusy} className="mt-5 rounded-pill bg-primary px-6 py-3 text-sm font-medium text-white shadow-lg shadow-black/20 disabled:opacity-60">{callBusy ? 'Connecting…' : 'Start conversation'}</button>}</div>}{(liveCaption || typing || latest?.content) && <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-black/55 px-4 py-3 text-sm leading-6 text-white/90 backdrop-blur-sm">{liveCaption || (typing ? `${person} is responding…` : latest?.content)}</div>}<div className="absolute bottom-4 right-4 h-28 w-44 overflow-hidden rounded-xl border border-white/30 bg-[#263341] shadow-xl sm:h-32 sm:w-52">{cameraOn && channel === 'video' ? <video ref={videoRef} autoPlay muted playsInline onLoadedMetadata={(event) => { void event.currentTarget.play().catch(() => undefined) }} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-3 text-center text-xs text-white/60">Your camera is off</div>}<span className="absolute bottom-2 left-2 rounded-pill bg-black/50 px-2 py-1 text-[10px] text-white/80">You</span></div></div><div className="mt-4 flex flex-wrap items-center justify-center gap-2">{(avatarEmbedUrl || (callConnected && channel === 'video')) && <button type="button" onClick={avatarEmbedUrl ? endSandboxAvatar : endLiveCall} disabled={avatarEnding || disabled} className="rounded-pill bg-red-500/80 px-3 py-2 text-xs disabled:opacity-50">{avatarEnding ? 'Ending conversation…' : 'End conversation'}</button>}{!avatarEmbedUrl && !callConnected && <button type="button" onClick={startSandboxAvatar} disabled={avatarEmbedBusy || disabled} className="rounded-pill bg-white/10 px-3 py-2 text-xs disabled:opacity-50">{avatarEmbedBusy ? 'Starting animated avatar…' : 'Try animated avatar'}</button>}<button type="button" onClick={avatarEmbedUrl ? switchToAudioFallback : () => startLiveCall(false)} disabled={avatarEnding || callBusy || (callConnected && !avatarEmbedUrl) || disabled} className="rounded-pill bg-white/10 px-3 py-2 text-xs">{avatarEmbedUrl ? 'Switch to Beckett video call' : callBusy ? 'Connecting…' : 'Start camera & mic'}</button><button type="button" onClick={enableMedia} className="rounded-pill bg-white/10 px-3 py-2 text-xs">{cameraOn || micOn ? 'Permissions ready' : 'Enable camera & mic'}</button><button type="button" onClick={toggleCamera} disabled={!streamRef.current} className="rounded-pill bg-white/10 px-3 py-2 text-xs disabled:opacity-40">{cameraOn ? 'Camera off' : 'Camera on'}</button><button type="button" onClick={toggleMic} disabled={!streamRef.current} className="rounded-pill bg-white/10 px-3 py-2 text-xs disabled:opacity-40">{micOn ? 'Mute mic' : 'Unmute mic'}</button><button type="button" onClick={() => setShowTranscript((value) => !value)} className="rounded-pill bg-white/10 px-3 py-2 text-xs">{showTranscript ? 'Hide transcript' : 'Show transcript'}</button>{showTranscript && <button type="button" onClick={captureSpeech} disabled={disabled || callConnected || Boolean(avatarEmbedUrl)} className="rounded-pill bg-white/10 px-3 py-2 text-xs disabled:opacity-40">Use text transcription</button>}</div><p className="mt-3 text-center text-xs leading-5 text-white/50">Video uses the simulated person’s live voice call first: your camera preview, microphone, spoken response, optional captions, and the same debrief. LiveAvatar remains an optional animated participant.</p>{(mediaError || audioError || avatarEmbedError) && <p className="mt-3 rounded-card bg-amber-100/10 px-3 py-2 text-xs leading-5 text-amber-100">{mediaError || audioError || avatarEmbedError}</p>}{showTranscript && <div className="mt-4 rounded-card bg-white/5 p-4"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-medium uppercase tracking-wide text-white/50">Live transcript</p><button type="button" onClick={() => setShowTranscript(false)} className="text-xs text-white/60 hover:text-white">Turn off</button></div><div className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm leading-6 text-white/85">{messages.length ? messages.slice(-6).map((message, index) => <p key={`${message.createdAt}-${index}`}><span className="font-medium text-white">{message.role === 'user' ? 'You' : person}:</span> {message.content}</p>) : <p className="text-white/45">Your conversation will appear here.</p>}</div><form onSubmit={onSubmit} className="mt-4 flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={callConnected ? 'Voice is live; type if needed…' : 'Text fallback if needed…'} className="min-w-0 flex-1 rounded-pill border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40" disabled={disabled} /><button type="submit" disabled={disabled || !input.trim()} className="rounded-pill bg-white px-4 py-2 text-xs font-medium text-ink disabled:opacity-40">Send</button></form></div>}</section>
}

export function PhoneCallFrame({ audioRef, person, messages: rawMessages, connected, ringing, connecting, paused, caption, error, input, setInput, onStart, onPause, onEnd, onSubmit, disabled }: { audioRef: React.RefObject<HTMLAudioElement | null>; person: string; messages: Message[]; connected: boolean; ringing: boolean; connecting: boolean; paused: boolean; caption: string; error: string; input: string; setInput: (value: string) => void; onStart: () => void; onPause: () => void; onEnd: () => void; onSubmit: (event: FormEvent) => void; disabled: boolean }) {
  const onMute = onPause
  const messages = rawMessages.filter((message, index, items) => items.findIndex((candidate) => candidate.role === message.role && candidate.content.replace(/\s+/g, ' ').trim().toLowerCase() === message.content.replace(/\s+/g, ' ').trim().toLowerCase()) === index)
  return <section className="mx-auto mb-5 max-w-3xl overflow-hidden rounded-[2rem] border border-[#D8D0C5] bg-[#F7F3ED] shadow-sm"><audio ref={audioRef} autoPlay /><div className="bg-[#1B2633] px-6 pb-7 pt-8 text-center text-white"><p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">Phone practice</p><div className="mx-auto mt-5 flex h-24 w-24 items-center justify-center rounded-full bg-[#D89219] text-4xl font-medium">{person.trim().charAt(0).toUpperCase() || 'B'}</div><h2 className="mt-4 text-2xl">{person}</h2><p className="mt-2 text-sm text-white/60">{ringing ? 'Ringing…' : connecting ? 'Connecting…' : connected ? 'Call in progress' : 'Ready to call'}</p><div className="mx-auto mt-6 max-w-sm rounded-card bg-black/20 px-4 py-3 text-sm leading-6 text-white/85">{connected ? (caption || 'You’re connected. They will greet you first.') : ringing ? 'The call is ringing. They will greet you when it connects.' : 'Start the call to hear a brief hello, then respond naturally.'}</div></div><div className="px-6 py-5"><div className="flex justify-center gap-3"><button type="button" onClick={onStart} disabled={connecting || ringing || connected || disabled} className="rounded-full bg-[#D89219] px-6 py-3 text-sm font-medium text-white disabled:opacity-50">{ringing ? 'Ringing…' : connecting ? 'Connecting…' : connected ? 'Call connected' : 'Start call'}</button><button type="button" onClick={onMute} disabled={!connected || disabled} className="rounded-full border border-border px-5 py-3 text-sm disabled:opacity-40">{paused ? 'Resume' : 'Pause'}</button><button type="button" onClick={onEnd} disabled={!connected || disabled} className="rounded-full bg-red-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-40">End call</button></div>{error && <p className="mt-4 rounded-card bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">{error}</p>}<div className="mt-6 border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-wide text-ink-light">Live transcript</p><div className="mt-3 min-h-16 space-y-2 text-sm leading-6">{messages.slice(-4).map((message, index) => <p key={`${message.createdAt}-${index}`}><span className="font-medium">{message.role === 'user' ? 'You' : person}:</span> {message.content}</p>)}{connected && !messages.length && <p className="text-ink-light">They will greet you first, then your response will appear here.</p>}</div><form onSubmit={onSubmit} className="mt-4 flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Text fallback if needed…" className="min-w-0 flex-1 rounded-pill border border-border bg-white px-4 py-2 text-sm outline-none focus:border-primary" disabled={disabled} /><button type="submit" disabled={disabled || !input.trim()} className="rounded-pill border border-border bg-white px-4 py-2 text-xs font-medium disabled:opacity-40">Send text</button></form></div></div></section>
}

function PhoneCallFrameCompact({ audioRef, person, connected, ringing, connecting, paused, caption, error, input, setInput, onStart, onPause, onEnd, onSubmit, disabled }: { audioRef: React.RefObject<HTMLAudioElement | null>; person: string; connected: boolean; ringing: boolean; connecting: boolean; paused: boolean; caption: string; error: string; input: string; setInput: (value: string) => void; onStart: () => void; onPause: () => void; onEnd: () => void; onSubmit: (event: FormEvent) => void; disabled: boolean }) {
  return <section className="mx-auto mb-5 max-w-3xl overflow-hidden rounded-card border border-[#D8D0C5] bg-[#F7F3ED] shadow-sm"><audio ref={audioRef} autoPlay /><div className="bg-[#1B2633] px-6 pb-7 pt-8 text-center text-white"><p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">Phone practice</p><div className="mx-auto mt-5 flex h-24 w-24 items-center justify-center rounded-full bg-[#D89219] text-4xl font-medium">{person.trim().charAt(0).toUpperCase() || 'B'}</div><h2 className="mt-4 text-2xl">{person}</h2><p className="mt-2 text-sm text-white/60">{ringing ? 'Ringing…' : connecting ? 'Connecting…' : connected ? 'Call in progress' : 'Ready to call'}</p><div className="mx-auto mt-6 max-w-xl rounded-card bg-black/20 px-4 py-3 text-sm leading-6 text-white/85">{connected ? (caption || 'You’re connected. They will greet you first.') : ringing ? 'The call is ringing. They will greet you when it connects.' : 'Start the call to hear a brief hello, then respond naturally.'}</div></div><div className="px-6 py-5"><div className="flex flex-wrap justify-center gap-3"><button type="button" onClick={onStart} disabled={connecting || ringing || connected || disabled} className="rounded-full bg-[#D89219] px-6 py-3 text-sm font-medium text-white disabled:opacity-50">{ringing ? 'Ringing…' : connecting ? 'Connecting…' : connected ? 'Call connected' : 'Start call'}</button><button type="button" onClick={onPause} disabled={!connected || disabled} className="rounded-full border border-border px-5 py-3 text-sm disabled:opacity-40">{paused ? 'Resume' : 'Pause'}</button><button type="button" onClick={onEnd} disabled={!connected || disabled} className="rounded-full bg-red-600 px-5 py-3 text-sm font-medium text-white disabled:opacity-40">End call</button></div>{error && <p className="mt-4 rounded-card bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">{error}</p>}<form onSubmit={onSubmit} className="mx-auto mt-5 flex max-w-xl gap-2 border-t border-border pt-5"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Text fallback if needed…" className="min-w-0 flex-1 rounded-pill border border-border bg-white px-4 py-2 text-sm outline-none focus:border-primary" disabled={disabled} /><button type="submit" disabled={disabled || !input.trim()} className="rounded-pill border border-border bg-white px-4 py-2 text-xs font-medium disabled:opacity-40">Send text</button></form></div></section>
}
