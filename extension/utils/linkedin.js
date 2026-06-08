const WORKER_URL = 'https://lumen-linkedin.sloane-oxleyhase.workers.dev';
const REDIRECT_URI = chrome.identity.getRedirectURL('linkedin');
const CLIENT_ID = '86bwavoe0p4o0u';

export async function connectLinkedIn() {
  const state = crypto.randomUUID();
  const authUrl = [
    'https://www.linkedin.com/oauth/v2/authorization',
    `?response_type=code`,
    `&client_id=${CLIENT_ID}`,
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
    `&scope=${encodeURIComponent('openid profile email')}`,
    `&state=${state}`,
  ].join('');

  // Chrome intercepts the redirect to REDIRECT_URI before the Worker runs,
  // giving us the auth code from the URL without hitting the Worker at this step.
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  const params = new URL(responseUrl).searchParams;
  if (params.get('state') !== state) throw new Error('OAuth state mismatch');
  const code = params.get('code');
  if (!code) throw new Error('No authorization code returned');

  // Send code to Worker for token exchange — returns OpenID Connect userinfo
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
  });

  if (!res.ok) throw new Error(`Worker error ${res.status}`);
  const profile = await res.json();

  const name = [profile.given_name, profile.family_name].filter(Boolean).join(' ');
  const stored = {
    name: name || profile.name || profile.email || 'LinkedIn user',
    email: profile.email || '',
    picture: profile.picture || '',
    // Populated if worker returns richer profile data (LinkedIn Professional API)
    headline: profile.headline || profile.localizedHeadline || '',
    industry: profile.industry || '',
  };

  await chrome.storage.local.set({ linkedInProfile: stored });
  return stored;
}

export function buildLinkedInContext(profile) {
  if (!profile?.name) return null;
  const parts = [profile.name];
  if (profile.headline) parts.push(profile.headline);
  if (profile.industry) parts.push(`industry: ${profile.industry}`);
  if (profile.email) parts.push(profile.email);
  return parts.join(' | ');
}
