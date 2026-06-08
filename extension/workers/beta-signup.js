// Cloudflare Worker — deploy to lumen-beta.sloane-oxleyhase.workers.dev
// KV namespace binding: BETA_SIGNUPS

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const { email, name, plan } = body;
    if (!email || !email.includes('@')) {
      return json({ error: 'Valid email required' }, 400);
    }

    const record = JSON.stringify({
      email,
      name: name || '',
      plan: plan || 'beta',
      timestamp: new Date().toISOString(),
    });

    await env.BETA_SIGNUPS.put(`signup:${email}`, record);

    return json({ success: true });
  },
};
