const $ = id => document.getElementById(id);
const BETA_WORKER = 'https://lumen-beta.sloane-oxleyhase.workers.dev';

// ── Beckett account ───────────────────────────────────────────────────────────

async function loadBeckettAccount() {
  const { beckettToken } = await chrome.storage.local.get('beckettToken');
  if (beckettToken) showBeckettConnected();
}

$('connectBeckett').addEventListener('click', async () => {
  const btn = $('connectBeckett');
  btn.disabled = true;
  btn.textContent = 'Connecting…';

  const response = await sendMessage('CONNECT_BECKETT', {});
  btn.disabled = false;
  btn.textContent = 'Log in with Beckett';

  if (response.error) { showBeckettStatus(response.error, 'err'); return; }
  showBeckettConnected();
  showBeckettStatus('Connected.', 'ok');
});

$('disconnectBeckett').addEventListener('click', async () => {
  await sendMessage('DISCONNECT_BECKETT', {});
  $('beckettConnected').hidden = true;
  $('connectBeckett').hidden = false;
  showBeckettStatus('Disconnected.', 'ok');
});

function showBeckettConnected() {
  $('beckettConnected').hidden = false;
  $('connectBeckett').hidden = true;
}

function showBeckettStatus(msg, type) {
  const el = $('beckettStatus');
  el.textContent = msg;
  el.className = `key-status ${type}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2500);
}

// ── Plan display ──────────────────────────────────────────────────────────────

async function loadPlan() {
  const { plan } = await chrome.storage.local.get('plan');
  const p = plan || 'free';
  const chip = $('planChip');
  if (p !== 'free') {
    chip.textContent = p.charAt(0).toUpperCase() + p.slice(1);
    chip.className = `plan-chip ${p}`;
    chip.hidden = false;
  }
  if (p === 'beta') $('betaSection').hidden = false;

}

// ── Mode toggle ───────────────────────────────────────────────────────────────

async function loadMode() {
  const { lumenMode, plan } = await chrome.storage.local.get(['lumenMode', 'plan']);
  const isPro = plan === 'pro' || plan === 'beta';
  applyMode(lumenMode || 'business', isPro);
}

function applyMode(mode, isPro) {
  $('modePersonal').classList.toggle('active', mode === 'personal');
  $('modeBusiness').classList.toggle('active', mode === 'business');
  if (!isPro && mode === 'business') {
    chrome.storage.local.set({ lumenMode: 'business', plan: 'beta' });
  }
}

$('modePersonal').addEventListener('click', () => {
  chrome.storage.local.set({ lumenMode: 'personal' });
  $('modePersonal').classList.add('active');
  $('modeBusiness').classList.remove('active');
});

$('modeBusiness').addEventListener('click', async () => {
  const { plan } = await chrome.storage.local.get('plan');
  const isPro = plan === 'pro' || plan === 'beta';
  if (!isPro) {
    await chrome.storage.local.set({ plan: 'beta' });
  }
  chrome.storage.local.set({ lumenMode: 'business' });
  $('modeBusiness').classList.add('active');
  $('modePersonal').classList.remove('active');
});

// ── LinkedIn ──────────────────────────────────────────────────────────────────

async function loadLinkedIn() {
  const { linkedInProfile } = await chrome.storage.local.get('linkedInProfile');
  if (linkedInProfile) showLinkedInProfile(linkedInProfile);
}

function showLinkedInProfile(profile) {
  const initials = profile.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  $('profileAvatar').textContent = initials;
  $('profileName').textContent = profile.name;
  $('profileEmail').textContent = profile.email || '';
  $('linkedInConnected').hidden = false;
  $('connectLinkedIn').hidden = true;
}

$('connectLinkedIn').addEventListener('click', async () => {
  const btn = $('connectLinkedIn');
  btn.disabled = true;
  btn.textContent = 'Connecting…';

  const response = await sendMessage('CONNECT_LINKEDIN', {});
  btn.disabled = false;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> Connect LinkedIn`;

  if (response.error) { showLinkedInStatus(response.error, 'err'); return; }
  showLinkedInProfile(response.profile);
  showLinkedInStatus('Connected!', 'ok');
});

$('disconnectLinkedIn').addEventListener('click', async () => {
  await chrome.storage.local.remove('linkedInProfile');
  $('linkedInConnected').hidden = true;
  $('connectLinkedIn').hidden = false;
});

function showLinkedInStatus(msg, type) {
  const el = $('linkedInStatus');
  el.textContent = msg;
  el.className = `linkedin-status ${type}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3000);
}

// ── Safe people ───────────────────────────────────────────────────────────────

let safePeople = [];

async function loadSafePeople() {
  const { safe_people = [] } = await chrome.storage.local.get('safe_people');
  safePeople = safe_people;
  renderSafeList();
}

function renderSafeList() {
  const list = $('safeList');
  if (!safePeople.length) {
    list.innerHTML = '<li class="safe-empty">No safe people yet.</li>';
    return;
  }
  list.innerHTML = safePeople.map((p, i) => `
    <li class="safe-item">
      <div class="safe-item-info">
        <span class="safe-item-name">${escHtml(p.name)}</span>
        ${p.email ? `<span class="safe-item-email">${escHtml(p.email)}</span>` : ''}
      </div>
      <button class="btn-remove" data-index="${i}" aria-label="Remove ${escHtml(p.name)}">✕</button>
    </li>
  `).join('');

  list.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.index, 10);
      await sendMessage('REMOVE_SAFE_PERSON', { index: idx });
      safePeople.splice(idx, 1);
      renderSafeList();
    });
  });
}

$('addSafePerson').addEventListener('click', async () => {
  const name = $('safePersonName').value.trim();
  const email = $('safePersonEmail').value.trim();
  if (!name) { showNote($('safeStatus'), 'Name is required.', 'warn'); return; }

  const person = { name, email };
  await sendMessage('SAVE_SAFE_PERSON', { person });
  safePeople.push(person);
  $('safePersonName').value = '';
  $('safePersonEmail').value = '';
  renderSafeList();
  showNote($('safeStatus'), `${name} added.`, 'ok');
});

// ── Gmail ─────────────────────────────────────────────────────────────────────

async function loadGmail() {
  const { currentUserEmail } = await chrome.storage.local.get('currentUserEmail');
  if (currentUserEmail) showGmailConnected(currentUserEmail);
}

function showGmailConnected(email) {
  $('gmailConnected').hidden = false;
  $('connectGmail').hidden = true;
  $('gmailUserEmail').textContent = email;
}

$('connectGmail').addEventListener('click', async () => {
  const btn = $('connectGmail');
  btn.disabled = true;
  btn.textContent = 'Connecting…';

  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, t => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(t);
      });
    });
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) throw new Error(`Gmail error ${res.status}`);
    const profile = await res.json();
    await chrome.storage.local.set({ currentUserEmail: profile.emailAddress });
    showGmailConnected(profile.emailAddress);
    showGmailStatus('Gmail connected!', 'ok');
  } catch (e) {
    showGmailStatus(e.message, 'err');
    btn.disabled = false;
    btn.textContent = 'Connect Gmail — enables full thread reading';
  }
});

$('disconnectGmail').addEventListener('click', async () => {
  await chrome.storage.local.remove('currentUserEmail');
  chrome.identity.clearAllCachedAuthTokens(() => {});
  $('gmailConnected').hidden = true;
  $('connectGmail').hidden = false;
});

function showGmailStatus(msg, type) {
  const el = $('gmailStatus');
  el.textContent = msg;
  el.className = `linkedin-status ${type}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3000);
}

// ── Slack ─────────────────────────────────────────────────────────────────────

async function loadSlack() {
  const { slackToken, slackUserId } = await chrome.storage.local.get(['slackToken', 'slackUserId']);
  if (slackToken) showSlackConnected(slackUserId || '');
}

function showSlackConnected(userId) {
  $('slackConnected').hidden = false;
  $('connectSlack').hidden = true;
  if (userId) $('slackUserId').textContent = `User ID: ${userId}`;
}

$('connectSlack').addEventListener('click', async () => {
  const btn = $('connectSlack');
  btn.disabled = true;
  btn.textContent = 'Connecting…';

  const response = await sendMessage('CONNECT_SLACK', {});
  btn.disabled = false;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg> Connect Slack`;

  if (response.error) { showSlackStatus(response.error, 'err'); return; }
  showSlackConnected(response.userId || '');
  showSlackStatus('Slack connected!', 'ok');
});

$('disconnectSlack').addEventListener('click', async () => {
  await sendMessage('DISCONNECT_SLACK', {});
  $('slackConnected').hidden = true;
  $('connectSlack').hidden = false;
});

function showSlackStatus(msg, type) {
  const el = $('slackStatus');
  el.textContent = msg;
  el.className = `linkedin-status ${type}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3000);
}

// ── Google Calendar ───────────────────────────────────────────────────────────

async function loadCalendar() {
  const { calendar_cache_ts } = await chrome.storage.local.get('calendar_cache_ts');
  if (calendar_cache_ts) showCalendarConnected();
}

function showCalendarConnected() {
  $('calendarConnected').hidden = false;
  $('connectCalendar').hidden = true;
}

$('connectCalendar').addEventListener('click', async () => {
  const btn = $('connectCalendar');
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  const response = await sendMessage('CONNECT_CALENDAR', {});
  btn.disabled = false;
  btn.textContent = 'Connect Calendar — enables pre-meeting briefs';
  if (response.error) { showCalendarStatus(response.error, 'err'); return; }
  showCalendarConnected();
  showCalendarStatus('Calendar connected!', 'ok');
});

function showCalendarStatus(msg, type) {
  const el = $('calendarStatus');
  el.textContent = msg;
  el.className = `linkedin-status ${type}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3000);
}

// ── Voice calibration ─────────────────────────────────────────────────────────

async function loadVoiceCalibration() {
  const { plan } = await chrome.storage.local.get('plan');
  const isPro = plan === 'pro' || plan === 'beta';
  if (!isPro) return;

  $('voiceSection').hidden = false;
  const stats = await sendMessage('GET_VOICE_STATS', {});
  const personal = stats.personal || 0;
  const business = stats.business || 0;
  if (personal > 0 || business > 0) {
    $('voiceCountNote').textContent =
      `${personal} personal message${personal !== 1 ? 's' : ''} learned · ${business} business message${business !== 1 ? 's' : ''} learned.`;
  }
}

$('resetVoiceBtn').addEventListener('click', async () => {
  if (!confirm('Reset your voice profile? This will clear all learned samples.')) return;
  await sendMessage('RESET_VOICE', {});
  $('voiceCountNote').textContent = 'Voice profile cleared.';
  showNote($('voiceResetStatus'), 'Voice profile reset.', 'ok');
});

// ── Beta email ────────────────────────────────────────────────────────────────

async function loadBetaEmail() {
  const { betaEmail } = await chrome.storage.local.get('betaEmail');
  if (betaEmail) {
    $('betaEmail').value = betaEmail;
    showNote($('betaEmailStatus'), 'Subscribed.', 'ok');
  }
}

$('saveBetaEmail').addEventListener('click', async () => {
  const email = $('betaEmail').value.trim();
  if (!email || !email.includes('@')) { showNote($('betaEmailStatus'), 'Enter a valid email.', 'warn'); return; }

  $('saveBetaEmail').disabled = true;
  $('saveBetaEmail').textContent = 'Saving…';

  try {
    await fetch(BETA_WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plan: 'beta', source: 'extension_popup' }),
    });
    await chrome.storage.local.set({ betaEmail: email });
    showNote($('betaEmailStatus'), "You're subscribed.", 'ok');
  } catch {
    showNote($('betaEmailStatus'), 'Could not save — try again.', 'warn');
  }

  $('saveBetaEmail').disabled = false;
  $('saveBetaEmail').textContent = 'Subscribe';
});

// ── Collapsibles ──────────────────────────────────────────────────────────────

['howToggle'].forEach(id => {
  $(id).addEventListener('click', () => {
    const bodyId = id.replace('Toggle', 'Body');
    const expanded = $(id).getAttribute('aria-expanded') === 'true';
    $(id).setAttribute('aria-expanded', String(!expanded));
    $(bodyId).hidden = expanded;
  });
});

// ── Utils ─────────────────────────────────────────────────────────────────────

function sendMessage(type, payload) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type, payload }, response => {
      resolve(response || { error: 'No response.' });
    });
  });
}

function showNote(el, text, type) {
  el.textContent = text;
  el.className = `field-note ${type}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3000);
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadBeckettAccount();
loadPlan();
loadMode();
loadGmail();
loadCalendar();
loadLinkedIn();
loadSlack();
loadSafePeople();
loadVoiceCalibration();
loadBetaEmail();
