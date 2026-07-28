import {
  buildMessagePrompt,
  buildMeetingPrompt,
  buildDraftFromScratchPrompt,
  buildMeetingBriefPrompt,
  buildDebriefPrompt,
  buildPracticeSystemPrompt,
  buildPracticeDebriefPrompt,
  buildVoiceContext,
  BECKETT_BOUNDARY_GUIDANCE,
} from '../utils/prompts.js';

const BECKETT_SITE = 'https://www.meetbeckett.co';
const BECKETT_API = `${BECKETT_SITE}/api`;

// ── Install / startup ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const { plan } = await chrome.storage.local.get('plan');
  if (!plan) await chrome.storage.local.set({ plan: 'beta', lumenMode: 'business' });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

function isBeckettAppUrl(url = '') {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'meetbeckett.co' || parsed.hostname === 'www.meetbeckett.co';
  } catch (_) {
    return false;
  }
}

function isSupportedWorkSurface(url = '') {
  return url.includes('mail.google.com') || url.includes('app.slack.com');
}

async function updateSidePanelForTab(tabId, url = '') {
  if (!tabId || !url) return;

  if (isBeckettAppUrl(url)) {
    await chrome.sidePanel.setOptions({ tabId, enabled: false }).catch(() => {});
    return;
  }

  if (isSupportedWorkSurface(url)) {
    await chrome.sidePanel.setOptions({ tabId, path: 'sidebar/sidebar.html', enabled: true }).catch(() => {});
    await chrome.sidePanel.open({ tabId }).catch(() => {});
    return;
  }

  await chrome.sidePanel.setOptions({ tabId, enabled: false }).catch(() => {});
}

// Auto-open side panel on Gmail and Slack, and disable it inside Beckett.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url) return;
  updateSidePanelForTab(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.url) updateSidePanelForTab(tabId, tab.url);
});

// Stored context per tab
const tabContexts = {};

// ── Message router ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {

    case 'CONTENT_UPDATED':
      tabContexts[tabId] = { ...message.payload, tabId };
      chrome.runtime.sendMessage({ type: 'CONTENT_UPDATED', context: tabContexts[tabId] }).catch(() => {});
      sendResponse({ ok: true });
      return true;

    case 'GET_CURRENT_CONTEXT':
      handleGetCurrentContext(sendResponse);
      return true;

    case 'TRIGGER_ANALYZE':
      handleTriggerAnalyze(message.payload, sendResponse);
      return true;

    case 'ANALYZE_MEETING':
      handleMeeting(message.payload, sender.tab?.id, sendResponse);
      return true;

    case 'MEETING_ENDED':
      chrome.runtime.sendMessage({ type: 'MEETING_ENDED', payload: message.payload }).catch(() => {});
      sendResponse({ ok: true });
      return true;

    case 'DRAFT_FROM_SCRATCH':
      handleDraftFromScratch(message.payload, sendResponse);
      return true;

    case 'INJECT_DRAFT':
      injectDraft(message.payload.text);
      sendResponse({ ok: true });
      return true;

    case 'CONNECT_SLACK':
      connectSlack()
        .then(result => sendResponse(result))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'CONNECT_BECKETT':
      connectBeckett()
        .then(result => sendResponse(result))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'DISCONNECT_BECKETT':
      chrome.storage.local.remove(['beckettToken'], () => sendResponse({ ok: true }));
      return true;

    case 'DISCONNECT_SLACK':
      chrome.storage.local.remove(['slackToken', 'slackUserId', 'slackUserName'], () => sendResponse({ ok: true }));
      return true;

    case 'GET_SETTINGS':
      getSettings().then(sendResponse);
      return true;

    case 'SAVE_SETTING':
      chrome.storage.local.set({ [message.payload.key]: message.payload.value }, () => sendResponse({ ok: true }));
      return true;

    case 'SAVE_SAFE_PERSON':
      saveSafePerson(message.payload.person).then(() => sendResponse({ ok: true }));
      return true;

    case 'REMOVE_SAFE_PERSON':
      removeSafePerson(message.payload.index).then(() => sendResponse({ ok: true }));
      return true;

    case 'SUBMIT_FEEDBACK':
      storeFeedback(message.payload).then(sendResponse);
      return true;

    case 'LOG_VOICE_SAMPLE':
      logVoiceSample(message.payload).then(() => sendResponse({ ok: true }));
      return true;

    case 'RESET_VOICE':
      chrome.storage.local.remove(['voice_samples', 'voice_edits'], () => sendResponse({ ok: true }));
      return true;

    case 'GET_VOICE_STATS':
      getVoiceStats().then(sendResponse);
      return true;

    case 'GET_CALENDAR_EVENTS':
      sendResponse({ error: 'Calendar support is coming after beta.' });
      return true;

    case 'CONNECT_CALENDAR':
      sendResponse({ error: 'Calendar support is coming after beta.' });
      return true;

    case 'GENERATE_MEETING_BRIEF':
      handleMeetingBrief(message.payload, sendResponse);
      return true;

    case 'GENERATE_DEBRIEF':
      handleDebrief(message.payload, sendResponse);
      return true;

    case 'PRACTICE_TURN':
      handlePracticeTurn(message.payload, sendResponse);
      return true;

    case 'PRACTICE_DEBRIEF':
      handlePracticeDebrief(message.payload, sendResponse);
      return true;

    case 'FETCH_CONTACT_HISTORY':
      handleFetchContactHistory(message.payload, sendResponse);
      return true;

    case 'ASK_ABOUT_CONTEXT':
      handleAskAboutContext(message.payload, sendResponse);
      return true;

    case 'OPEN_SIDE_PANEL':
      if (tabId) chrome.sidePanel.open({ tabId }).catch(() => {});
      sendResponse({ ok: true });
      return true;

    case 'OPEN_SETTINGS':
      chrome.tabs.create({ url: 'https://meetbeckett.co/dashboard/settings' });
      sendResponse({ ok: true });
      return true;

    case 'OPEN_CONTACTS':
      chrome.tabs.create({ url: 'https://meetbeckett.co/dashboard/contacts' });
      sendResponse({ ok: true });
      return true;
  }
});

// ── Core handlers ─────────────────────────────────────────────

async function handleGetCurrentContext(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { sendResponse({ context: null }); return; }

    // Use cached context if available
    if (tabContexts[tab.id]) {
      sendResponse({ context: tabContexts[tab.id] });
      return;
    }

    const ctx = await extractContextFromTab(tab);
    if (ctx) tabContexts[tab.id] = { ...ctx, tabId: tab.id };
    sendResponse({ context: ctx });
  } catch (e) {
    sendResponse({ context: null });
  }
}

async function handleTriggerAnalyze(payload, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { sendResponse({ error: 'No active tab found.' }); return; }

    const ctx = await extractContextFromTab(tab) || tabContexts[tab.id] || null;

    if (!ctx) {
      sendResponse({ error: 'Could not read this conversation. Open a Slack channel or DM, wait for messages to load, then try again.' });
      return;
    }

    const { lumenMode, plan, voice_samples, slackUserName, beckettUserName, beckettUserEmail, slackToken, slackUserId, beckettSlackConnected, beckettSlackUserId } = await chrome.storage.local.get([
      'lumenMode', 'plan', 'voice_samples', 'slackUserName', 'beckettUserName', 'beckettUserEmail', 'slackToken', 'slackUserId', 'beckettSlackConnected', 'beckettSlackUserId',
    ]);
    const mode = payload.mode || lumenMode || 'business';
    const isPro = plan === 'pro' || plan === 'beta';
    const voiceContext = isPro ? buildVoiceContext(voice_samples, mode) : '';

    // Enrich Gmail thread via API — fetches all messages including collapsed ones
    let thread = ctx.thread || null;
    let enrichedContext = null;
    let gmailEnrichmentReason = null;
    if (ctx.platform === 'gmail' && (ctx.threadId || ctx.subject || ctx.senderEmail)) {
      try {
        const backendThread = await fetchBackendGmailThread(ctx);
        if (backendThread.messages?.length) {
          thread = backendThread.messages;
          enrichedContext = buildEnrichedGmailContext(ctx, backendThread.messages);
        }
      } catch (e) {
        gmailEnrichmentReason = e.message || 'gmail_backend_unavailable';
        console.warn('Beckett: backend Gmail thread fetch failed:', e.message);
      }

    }

    // Resolve user identity so Beckett can speak to the user directly.
    const currentUser = {
      name: ctx.currentUserName || slackUserName || beckettUserName || null,
      email: beckettUserEmail || null,
    };

    const analysisContext = enrichedContext || ctx;
    const prompt = buildMessagePrompt({
      messageText: analysisContext.messageText,
      thread,
      sender: analysisContext.sender,
      platform: analysisContext.platform,
      channelType: analysisContext.channelType,
      mode,
      linkedInContext: null,
      isSafePerson: analysisContext.isSafePerson || false,
      voiceContext,
      currentUser,
    });

    const analysisMetadata = {
      platform: ctx.platform,
      mode,
      source: ctx.platform === 'slack' ? (ctx.source || 'slack_dom') : (ctx.platform === 'gmail' && thread !== ctx.thread ? 'gmail_api' : 'page_dom'),
      threadCount: Array.isArray(thread) ? thread.length : 0,
      channelType: analysisContext.channelType || null,
      channelName: analysisContext.channelName || null,
      gmailEnrichmentReason,
      slackConnected: ctx.platform === 'slack' ? (!!slackToken || !!beckettSlackConnected) : null,
      slackUserId: ctx.platform === 'slack' ? (slackUserId || beckettSlackUserId || null) : null,
    };

    const result = await callBeckettJson('analyze_message', prompt, 1000, {
      platform: ctx.platform,
      mode,
      source: analysisMetadata.source,
      threadCount: analysisMetadata.threadCount,
      gmailEnrichmentReason,
    });
    sendResponse({
      result,
      isSafePerson: analysisContext.isSafePerson || false,
      sender: analysisContext.sender,
      senderEmail: analysisContext.senderEmail || null,
      metadata: analysisMetadata,
      context: enrichedContext,
    });
  } catch (e) {
    sendResponse({ error: friendlyAnalyzeError(e) });
  }
}

function friendlyAnalyzeError(error) {
  const message = error?.message || 'Analysis failed.';
  if (/Could not read the page/i.test(message)) {
    return 'Could not read this conversation. Open a Slack channel or DM, wait for messages to load, then try again.';
  }
  if (/Daily beta AI limit/i.test(message)) return message;
  if (/Unauthorized|Beta access required/i.test(message)) {
    return 'Beckett login is not connected. Open the extension settings and log in with Beckett again.';
  }
  if (/Slack|token|authorization/i.test(message)) {
    return `${message} Reconnect Slack from Settings if this keeps happening.`;
  }
  return message;
}

function buildEnrichedGmailContext(ctx, messages) {
  const latestIncoming = [...messages].reverse().find(m => !m.isCurrentUser);
  return {
    ...ctx,
    thread: messages,
    messageText: latestIncoming?.body || ctx.messageText,
    sender: latestIncoming?.sender || ctx.sender,
    senderEmail: latestIncoming?.senderEmail || ctx.senderEmail || null,
    source: 'gmail_api',
  };
}

async function fetchBackendGmailThread(ctx) {
  const { beckettToken } = await chrome.storage.local.get('beckettToken');
  if (!beckettToken) throw new Error('beckett_not_connected');

  const params = new URLSearchParams();
  const threadIds = [
    ctx.threadId,
    ...(ctx.threadIds || []),
    ...(ctx.thread || []).map(m => m.threadId),
  ].filter(Boolean);
  const messageIds = [
    ...(ctx.messageIds || []),
    ...(ctx.thread || []).map(m => m.messageId),
  ].filter(Boolean);
  const visibleText = (ctx.thread || [])
    .map(m => m.body || m.text || '')
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || ctx.messageText || '';

  if (threadIds.length) params.set('threadIds', [...new Set(threadIds)].join(','));
  if (messageIds.length) params.set('messageIds', [...new Set(messageIds)].join(','));
  if (ctx.subject) params.set('subject', ctx.subject);
  if (ctx.senderEmail) params.set('senderEmail', ctx.senderEmail);
  if (visibleText) params.set('visibleText', visibleText.slice(0, 500));

  const res = await fetch(`${BECKETT_API}/extension/gmail/thread?${params.toString()}`, {
    headers: { Authorization: `Bearer ${beckettToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `gmail_backend_error_${res.status}`);
  return data;
}

async function extractContextFromTab(tab) {
  if (!tab?.id) return null;

  let ctx = await sendExtractMessage(tab.id);
  if (ctx) return ctx;

  const script = getContentScriptForUrl(tab.url || '');
  if (!script) return null;

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [script] });
    await new Promise(resolve => setTimeout(resolve, 250));
    ctx = await sendExtractMessage(tab.id);
    return ctx;
  } catch (_) {
    return null;
  }
}

function sendExtractMessage(tabId) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTEXT' }, res => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(res?.context || null);
    });
  });
}

function getContentScriptForUrl(url) {
  if (url.includes('mail.google.com')) return 'content/gmail.js';
  if (url.includes('app.slack.com')) return 'content/slack.js';
  return null;
}

async function handleMeeting(payload, tabId, sendResponse) {
  try {
    const { lumenMode, plan } = await chrome.storage.local.get(['lumenMode', 'plan']);
    const isPro = plan === 'pro' || plan === 'beta';
    if (!isPro) { sendResponse({ error: 'Meeting guidance is a Pro feature.' }); return; }

    const mode = lumenMode || 'business';
    const prompt = buildMeetingPrompt({
      ...payload,
      mode,
      linkedInContext: null,
    });

    const result = await callBeckettJson('analyze_message', prompt, 1000, { platform: 'meeting', mode });
    chrome.runtime.sendMessage({ type: 'MEETING_RESULT', data: result }).catch(() => {});
    sendResponse({ result });
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

async function handleDraftFromScratch(payload, sendResponse) {
  try {
    const { lumenMode, voice_samples } = await chrome.storage.local.get([
      'lumenMode', 'voice_samples',
    ]);
    const mode = payload.mode || lumenMode || 'business';
    const voiceContext = buildVoiceContext(voice_samples, mode);

    const prompt = buildDraftFromScratchPrompt({
      ...payload,
      mode,
      linkedInContext: null,
      voiceContext,
    });

    const raw = await callBeckettText('draft_from_scratch', prompt, 800, { mode });
    sendResponse({ text: raw.trim() });
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

// ── New v3 handlers ───────────────────────────────────────────

async function handleMeetingBrief(payload, sendResponse) {
  try {
    const { lumenMode } = await chrome.storage.local.get('lumenMode');
    const mode = lumenMode || 'business';

    const prompt = buildMeetingBriefPrompt({
      meetingTitle: payload.meetingTitle,
      attendees: payload.attendees,
      recentThreads: '',
      mode,
    });

    const result = await callBeckettText('meeting_brief', prompt, 900, { mode });
    sendResponse({ result: result.trim() });
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

async function handleDebrief(payload, sendResponse) {
  try {
    const { transcript, meetingType } = payload;
    if (!transcript || transcript.split(/\s+/).length < 50) {
      sendResponse({ error: 'Transcript too short for a debrief.' });
      return;
    }

    const { lumenMode } = await chrome.storage.local.get('lumenMode');
    const mode = lumenMode || 'business';

    const prompt = buildDebriefPrompt({
      transcript,
      meetingTitle: meetingType || 'Meeting',
      attendees: '',
      mode,
    });

    const result = await callBeckettText('meeting_debrief', prompt, 1000, { mode });
    sendResponse({ result: result.trim() });
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

async function handlePracticeTurn(payload, sendResponse) {
  try {
    const { system, messages } = payload;
    const result = await callBeckettChat('practice_turn', system, messages, 600);
    sendResponse({ text: result.trim() });
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

async function handlePracticeDebrief(payload, sendResponse) {
  try {
    const { personDescription, situation, goal, conversationHistory } = payload;
    const prompt = buildPracticeDebriefPrompt({ personDescription, situation, goal, conversationHistory });
    const result = await callBeckettText('practice_debrief', prompt, 800);
    sendResponse({ result: result.trim() });
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

async function handleAskAboutContext(payload, sendResponse) {
  try {
    const { question, context, lastResult, mode } = payload;
    const visibleThread = context?.thread || [];

    const threadSummary = visibleThread
      .slice(-20)
      .map(m => `[${m.sender}]${m.isCurrentUser ? ' (you)' : ''}: ${m.body || m.text || ''}`)
      .join('\n');

    const latestMessage = visibleThread.length ? visibleThread[visibleThread.length - 1] : null;
    const latestMessageStatus = latestMessage
      ? `Latest visible message: ${latestMessage.isCurrentUser ? 'from you' : `from ${latestMessage.sender || 'the other person'}`}.`
      : 'Latest visible message: unknown.';

    const system = [
      'You are Beckett, an AI communication coach for neurodivergent professionals.',
      'Answer the user\'s question about their conversation clearly and concisely.',
      BECKETT_BOUNDARY_GUIDANCE,
      'Use only the actual messages provided in the conversation thread as evidence.',
      'Do not invent replies, reactions, agreement, comfort, rapport, intent, or relationship dynamics that are not visible.',
      'If someone has not responded to a message yet, say that clearly. Do not describe how they reacted to it.',
      'The previous analysis is non-authoritative context and may be incomplete. Never use it to add facts that are not present in the thread.',
      'When the evidence is limited, say what you can and cannot tell.'
    ].join(' ');

    const user = `Platform: ${context?.platform || 'unknown'} | Sender: ${context?.sender || 'unknown'}

Conversation thread:
${threadSummary || '(no thread available)'}

${latestMessageStatus}

Previous analysis, for orientation only. Do not treat this as evidence:
- Intent: ${lastResult?.intent || ''}
- Tone: ${lastResult?.tone || ''}
- What they want: ${lastResult?.want || ''}

User's question: "${question}"

Answer as 1-3 short bullets. Be specific to the actual conversation above. If the answer is not visible in the thread, say so directly.`;

    const answer = await callBeckettText('ask_about_context', { system, user }, 800, { mode: mode || null });
    sendResponse({ answer: answer.trim() });
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

async function handleFetchContactHistory(payload, sendResponse) {
  try {
    const { email } = payload;
    if (!email) { sendResponse({ threads: [], slackMessages: [] }); return; }

    const cacheKey = `contact_history_${email.replace(/[^a-z0-9]/gi, '_')}`;
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey] && Date.now() - cached[cacheKey].ts < 24 * 60 * 60 * 1000) {
      sendResponse({ threads: cached[cacheKey].threads, slackMessages: cached[cacheKey].slackMessages || [] });
      return;
    }

    const threads = [];

    // Also fetch Slack DM history if Slack is connected
    let slackMessages = [];
    const { slackToken } = await chrome.storage.local.get('slackToken');
    if (slackToken) {
      slackMessages = await fetchSlackContactHistory(email, slackToken);
    }

    await chrome.storage.local.set({ [cacheKey]: { threads, slackMessages, ts: Date.now() } });
    sendResponse({ threads, slackMessages });
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

async function fetchSlackContactHistory(email, slackToken) {
  try {
    // Find DM channel with this user by matching email → Slack user ID
    const usersRes = await fetch(
      `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${slackToken}` } }
    );
    const usersData = await usersRes.json();
    if (!usersData.ok || !usersData.user?.id) return [];

    const userId = usersData.user.id;

    // Open or find existing DM channel
    const openRes = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: { Authorization: `Bearer ${slackToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: userId }),
    });
    const openData = await openRes.json();
    if (!openData.ok || !openData.channel?.id) return [];

    const channelId = openData.channel.id;
    const histRes = await fetch(
      `https://slack.com/api/conversations.history?channel=${channelId}&limit=50`,
      { headers: { Authorization: `Bearer ${slackToken}` } }
    );
    const histData = await histRes.json();
    if (!histData.ok) return [];

    return (histData.messages || [])
      .filter(m => m.text)
      .slice(0, 50)
      .map(m => ({ text: m.text, ts: m.ts }));
  } catch (_) {
    return [];
  }
}

// ── Voice calibration ─────────────────────────────────────────

async function logVoiceSample(payload) {
  const { voice_samples = [] } = await chrome.storage.local.get('voice_samples');
  voice_samples.push({ text: payload.text, mode: payload.mode, platform: payload.platform, timestamp: Date.now() });
  if (voice_samples.length > 100) voice_samples.splice(0, voice_samples.length - 100);
  await chrome.storage.local.set({ voice_samples });
}

async function getVoiceStats() {
  const { voice_samples = [] } = await chrome.storage.local.get('voice_samples');
  const personal = voice_samples.filter(s => s.mode === 'personal').length;
  const business = voice_samples.filter(s => s.mode === 'business').length;
  return { personal, business, total: voice_samples.length };
}

// ── Slack OAuth ───────────────────────────────────────────────

async function connectSlack() {
  await chrome.tabs.create({ url: `${BECKETT_SITE}/api/slack/connect` });
  return { ok: true, opened: true };
}

async function connectBeckett() {
  const redirectUri = chrome.identity.getRedirectURL('beckett');
  const authUrl = `${BECKETT_SITE}/auth/extension-connect?redirect_uri=${encodeURIComponent(redirectUri)}`;

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, url => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(url);
    });
  });

  const params = new URL(responseUrl).searchParams;
  const token = params.get('token');
  if (!token) throw new Error('Beckett connection cancelled.');
  const name = params.get('name');
  const email = params.get('email');

  await chrome.storage.local.set({
    beckettToken: token,
    plan: params.get('plan') || 'beta',
    lumenMode: 'business',
    ...(name && { beckettUserName: name }),
    ...(email && { beckettUserEmail: email }),
  });

  await syncBeckettProfile(token);

  return { ok: true, plan: params.get('plan') || 'beta' };
}

// ── Draft injection ───────────────────────────────────────────

async function injectDraft(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: 'INJECT_DRAFT', text }).catch(() => {});
}

// ── Storage helpers ───────────────────────────────────────────

async function getSettings() {
  const keys = [
    'plan', 'lumenMode',
    'safe_people', 'voice_samples',
    'slackToken', 'slackUserId', 'slackUserName', 'beckettSlackConnected', 'beckettSlackUserId', 'beckettSlackTeamName', 'beckettToken', 'beckettUserName', 'beckettUserEmail',
  ];
  const data = await chrome.storage.local.get(keys);
  if (data.beckettToken) {
    const profile = await syncBeckettProfile(data.beckettToken).catch(() => null);
    if (profile) {
      data.beckettUserName = profile.name || data.beckettUserName;
      data.beckettUserEmail = profile.email || data.beckettUserEmail;
      if (profile.plan) data.plan = profile.plan;
      data.beckettSlackConnected = !!profile.integrations?.slack?.connected;
      data.beckettSlackUserId = profile.integrations?.slack?.userId || '';
      data.beckettSlackTeamName = profile.integrations?.slack?.teamName || '';
    }
  }
  const samples = data.voice_samples || [];
  return {
    apiKey: '',
    plan: data.plan || 'free',
    mode: data.lumenMode || 'business',
    safePeople: data.safe_people || [],
    voiceSampleCounts: {
      personal: samples.filter(s => s.mode === 'personal').length,
      business: samples.filter(s => s.mode === 'business').length,
    },
    slackConnected: !!data.slackToken || !!data.beckettSlackConnected,
    slackUserId: data.slackUserId || data.beckettSlackUserId || '',
    slackUserName: data.slackUserName || '',
    slackTeamName: data.beckettSlackTeamName || '',
    gmailUserEmail: data.beckettUserEmail || '',
    beckettToken: data.beckettToken || null,
    beckettUserName: data.beckettUserName || '',
    beckettUserEmail: data.beckettUserEmail || '',
  };
}

async function syncBeckettProfile(token) {
  const res = await fetch(`${BECKETT_API}/extension/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const profile = await res.json();
  await chrome.storage.local.set({
    ...(profile.name && { beckettUserName: profile.name }),
    ...(profile.email && { beckettUserEmail: profile.email }),
    ...(profile.plan && { plan: profile.plan }),
    beckettSlackConnected: !!profile.integrations?.slack?.connected,
    beckettSlackUserId: profile.integrations?.slack?.userId || '',
    beckettSlackTeamName: profile.integrations?.slack?.teamName || '',
  });
  return profile;
}

async function saveSafePerson(person) {
  const { safe_people = [] } = await chrome.storage.local.get('safe_people');
  safe_people.push(person);
  await chrome.storage.local.set({ safe_people });
}

async function removeSafePerson(index) {
  const { safe_people = [] } = await chrome.storage.local.get('safe_people');
  safe_people.splice(index, 1);
  await chrome.storage.local.set({ safe_people });
}

async function storeFeedback(entry) {
  const { lumen_feedback = [] } = await chrome.storage.local.get('lumen_feedback');
  const localEntry = { ...entry, synced: false };
  lumen_feedback.push(localEntry);
  await chrome.storage.local.set({ lumen_feedback });

  const { beckettToken } = await chrome.storage.local.get('beckettToken');
  if (!beckettToken) return { ok: true, synced: false };

  const response = await fetch(`${BECKETT_API}/extension/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${beckettToken}`,
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return { ok: true, synced: false, error: data.error || `Feedback sync failed ${response.status}` };
  }

  localEntry.synced = true;
  await chrome.storage.local.set({ lumen_feedback });
  return { ok: true, synced: true };
}

// ── API helpers ───────────────────────────────────────────────

async function callBeckettAi(action, { system = null, user = null, messages = null, responseFormat = 'text', maxTokens = 900, metadata = {} }) {
  const { beckettToken } = await chrome.storage.local.get('beckettToken');
  if (!beckettToken) throw new Error('Connect your Beckett account first.');

  const response = await fetch(`${BECKETT_API}/extension/ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${beckettToken}`,
    },
    body: JSON.stringify({
      action,
      system,
      messages: messages || [{ role: 'user', content: user }],
      maxTokens,
      responseFormat,
      metadata,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || `Beckett API error ${response.status}`);
  }

  return response.json();
}

async function callBeckettJson(action, prompt, maxTokens, metadata = {}) {
  const data = await callBeckettAi(action, { ...prompt, maxTokens, responseFormat: 'json', metadata });
  return data.result;
}

async function callBeckettText(action, prompt, maxTokens, metadata = {}) {
  const data = await callBeckettAi(action, { ...prompt, maxTokens, responseFormat: 'text', metadata });
  return data.text || '';
}

async function callBeckettChat(action, system, messages, maxTokens, metadata = {}) {
  const data = await callBeckettAi(action, { system, messages, maxTokens, responseFormat: 'text', metadata });
  return data.text || '';
}
