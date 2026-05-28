const DEFAULT_MODEL = 'eleven_flash_v2_5';
const MAX_TEXT_LENGTH = 240;

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || origin || '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function json(data, status, origin, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin, env),
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function handleTts(request, env, origin) {
  if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) {
    return json({ error: 'Worker is missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID' }, 500, origin, env);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON body' }, 400, origin, env);
  }

  const text = String(body.text || '').trim();
  if (!text) return json({ error: 'Text is required' }, 400, origin, env);
  if (text.length > MAX_TEXT_LENGTH) {
    return json({ error: `Text is too long. Max ${MAX_TEXT_LENGTH} characters.` }, 413, origin, env);
  }

  const speed = clampNumber(body.rate, 0.7, 1.3, 1);
  const model = env.ELEVENLABS_MODEL || DEFAULT_MODEL;
  const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`;
  const elevenRes = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.85,
        style: 0,
        use_speaker_boost: true,
        speed
      }
    })
  });

  if (!elevenRes.ok) {
    const detail = await elevenRes.text();
    return json({ error: 'ElevenLabs request failed', detail: detail.slice(0, 300) }, elevenRes.status, origin, env);
  }

  return new Response(elevenRes.body, {
    status: 200,
    headers: {
      ...corsHeaders(origin, env),
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
      'X-Character-Count': elevenRes.headers.get('x-character-count') || ''
    }
  });
}

async function handleQuota(env, origin) {
  if (!env.ELEVENLABS_API_KEY) {
    return json({ error: 'Worker is missing ELEVENLABS_API_KEY' }, 500, origin, env);
  }

  const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY }
  });

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: 'Quota request failed', detail: detail.slice(0, 300) }, res.status, origin, env);
  }

  const data = await res.json();
  const used = Number(data.character_count || 0);
  const limit = Number(data.character_limit || 0);
  return json({
    tier: data.tier,
    status: data.status,
    used,
    limit,
    remaining: limit - used,
    voiceSlotsUsed: data.voice_slots_used,
    voiceLimit: data.voice_limit,
    canUseInstantVoiceCloning: data.can_use_instant_voice_cloning,
    canUseProfessionalVoiceCloning: data.can_use_professional_voice_cloning,
    nextResetUnix: data.next_character_count_reset_unix
  }, 200, origin, env);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    const url = new URL(request.url);
    if (url.pathname === '/tts' && request.method === 'POST') {
      return handleTts(request, env, origin);
    }
    if (url.pathname === '/quota' && request.method === 'GET') {
      return handleQuota(env, origin);
    }
    if (url.pathname === '/health') {
      return json({ ok: true }, 200, origin, env);
    }

    return json({ error: 'Not found' }, 404, origin, env);
  }
};
