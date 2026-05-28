// POST /api/resolver/embed
// Server-side proxy that turns a text query into an OpenAI embedding vector
// for the hybrid resolver (xerenity-db resolve_query p_embedding parameter).
//
// Why a proxy:
//   - Keeps OPENAI_API_KEY server-side (never shipped to the browser).
//   - Lets us add rate limiting / caching / auth checks server-side later.
//
// Auth: requires an authenticated Supabase session + super_admin role
//   (resolver is super_admin-gated during MVP; no point letting other
//   users burn embedding tokens).

import type { NextApiRequest, NextApiResponse } from 'next';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
};

const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims — matches DB column
const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const MAX_INPUT_LEN = 2000; // chars — generous cap for safety

interface EmbedSuccess {
  embedding: number[];
  model: string;
  dimensions: number;
}

interface EmbedError {
  error: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EmbedSuccess | EmbedError>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth + role check
  const supabase = createPagesServerClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Use the DB-level is_super_admin() RPC — same gate as resolver functions.
  const { data: isAdmin, error: adminError } = await supabase
    .schema('xerenity')
    .rpc('is_super_admin');

  if (adminError || !isAdmin) {
    return res.status(403).json({
      error: adminError
        ? `super_admin check failed: ${adminError.message}`
        : 'super_admin required',
    });
  }

  // Validate input
  const text: unknown = req.body?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'body.text is required (non-empty string)' });
  }
  if (text.length > MAX_INPUT_LEN) {
    return res.status(400).json({ error: `text too long (max ${MAX_INPUT_LEN} chars)` });
  }

  // OpenAI key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
  }

  // Call OpenAI
  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.trim(),
        encoding_format: 'float',
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => 'unknown');
      return res.status(502).json({ error: `OpenAI error ${r.status}: ${errText.slice(0, 300)}` });
    }

    const json = (await r.json()) as {
      data?: { embedding: number[] }[];
      model?: string;
    };
    const embedding = json.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      return res.status(502).json({ error: 'OpenAI returned no embedding' });
    }

    return res.status(200).json({
      embedding,
      model: json.model ?? EMBEDDING_MODEL,
      dimensions: embedding.length,
    });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : 'unknown error',
    });
  }
}
