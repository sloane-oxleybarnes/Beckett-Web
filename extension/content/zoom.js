// Zoom web client content script — live caption capture, sends to Lumen side panel

(function () {
  const BUFFER_SECONDS = 60;
  const ANALYSIS_INTERVAL_MS = 15000;

  let captionBuffer = [];
  let callStartTime = null;
  let analysisInterval = null;
  let captionObserver = null;
  let lastAnalyzed = '';

  const CAPTION_SELECTORS = [
    '.caption-text',
    '[class*="caption"]',
    '.zmwebsdk-MuiTypography-root',
    '[aria-live="polite"]',
  ];

  function addCaption(text) {
    if (!text || text.length < 4) return;
    const now = Date.now();
    captionBuffer.push({ text, ts: now });
    const cutoff = now - BUFFER_SECONDS * 1000;
    captionBuffer = captionBuffer.filter(c => c.ts > cutoff);
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
    const transcript = getTranscript();
    clearInterval(analysisInterval);
    callStartTime = null;
    captionObserver?.disconnect();
    sendToBackground('MEETING_ENDED', { transcript, meetingType: 'Zoom video call' });
  }

  async function analyzeTranscript() {
    const transcript = getTranscript();
    if (!transcript || transcript === lastAnalyzed) return;
    lastAnalyzed = transcript;
    sendToBackground('ANALYZE_MEETING', { transcript, meetingType: 'Zoom video call' });
  }

  function observeCaptions(root) {
    captionObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          CAPTION_SELECTORS.forEach(sel => {
            if (node.matches?.(sel)) addCaption(node.textContent?.trim());
            node.querySelectorAll?.(sel).forEach(el => addCaption(el.textContent?.trim()));
          });
        });
        if (mutation.target.getAttribute?.('aria-live') === 'polite') {
          addCaption(mutation.target.textContent?.trim());
        }
      }
    });
    captionObserver.observe(root, { childList: true, subtree: true, characterData: true });
  }

  const callDetector = new MutationObserver(() => {
    const callActive = document.querySelector('[class*="meeting-app"]') ||
                       document.querySelector('#wc-container-left') ||
                       document.querySelector('.zmwebsdk-makeStyles-root');
    if (callActive && !callStartTime) observeCaptions(document.body);

    const leftMeeting = !document.querySelector('[class*="meeting-app"]') ||
                        document.querySelector('[class*="leaveConfirm"]');
    if (leftMeeting && callStartTime) stopSession();
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
