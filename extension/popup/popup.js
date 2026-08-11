const $ = id => document.getElementById(id);

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

$('manageGmail').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.meetbeckett.co/dashboard/settings#connected-accounts' });
});

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
loadSafePeople();
loadVoiceCalibration();
