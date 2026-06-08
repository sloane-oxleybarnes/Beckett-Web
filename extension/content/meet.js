// Google Meet content script — live caption capture, sends to Lumen side panel

(function () {
  const BUFFER_SECONDS = 60;
  const ANALYSIS_INTERVAL_MS = 15000;

  let captionBuffer = [];
  let fullTranscript = [];
  let callStartTime = null;
  let analysisInterval = null;
  let captionObserver = null;
  let lastAnalyzed = '';

  function addCaption(text) {
    if (!text || text.length < 4) return;
    const now = Date.now();
    captionBuffer.push({ text, ts: now });
    const cutoff = now - BUFFER_SECONDS * 1000;
    captionBuffer = captionBuffer.filter(c => c.ts > cutoff);
    fullTranscript.push(text);
    if (!callStartTime) startSession();
  }

  function getTranscript() {
    return captionBuffer.map(c => c.text).join(' ').trim();
  }

  function startSession() {
    callStartTime = Date.now();
    analysisInterval = setInterval(analyzeTranscript, ANALYSIS_INTERVAL_MS);
  }

  function stopSession() {
    const transcript = fullTranscript.join(' ').trim() || getTranscript();
    fullTranscript = [];
    clearInterval(analysisInterval);
    callStartTime = null;
    captionObserver?.disconnect();
    sendToBackground('MEETING_ENDED', { transcript, meetingType: 'Google Meet' });
  }

  async function analyzeTranscript() {
    const transcript = getTranscript();
    if (!transcript || transcript === lastAnalyzed) return;
    lastAnalyzed = transcript;
    sendToBackground('ANALYZE_MEETING', { transcript, meetingType: 'Google Meet' });
  }

  const CAPTION_SELECTORS = ['.TBMuR', '[jsname="tgaKEf"]', '[data-is-censored]', '.iOzk7'];

  function observeCaptions(root) {
    captionObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const text = node.textContent?.trim();
          if (text && text.length > 3) addCaption(text);
          CAPTION_SELECTORS.forEach(sel => {
            node.querySelectorAll?.(sel).forEach(el => {
              const t = el.textContent?.trim();
              if (t && t.length > 3) addCaption(t);
            });
          });
        });
        if (mutation.type === 'characterData') {
          const text = mutation.target.textContent?.trim();
          if (text && text.length > 3) addCaption(text);
        }
      }
    });
    captionObserver.observe(root, { childList: true, subtree: true, characterData: true });
  }

  const callDetector = new MutationObserver(() => {
    const callActive = document.querySelector('.crqnQb') || document.querySelector('[jsname="EydYod"]');
    if (callActive && !callStartTime) observeCaptions(document.body);
    if (!callActive && callStartTime) stopSession();

    // Post-call screen — triggers debrief offer
    const callEnded = document.querySelector('.Aj4Xvb') || document.querySelector('[data-call-ended]');
    if (callEnded && !callStartTime) {
      // Already stopped via above — no-op (stopSession already fired)
    }
  });

  callDetector.observe(document.body, { childList: true, subtree: true });

  function sendToBackground(type, payload) {
    try {
      chrome.runtime.sendMessage({ type, payload }, () => {});
    } catch (e) {
      if (!e?.message?.includes('Extension context invalidated')) throw e;
    }
  }
})();
