#!/usr/bin/env tsx
/* eslint-disable
   no-console,
   no-restricted-syntax,
   no-await-in-loop,
   no-continue,
   no-plusplus,
   prefer-template
*/
/**
 * Populate OpenAI embeddings for the resolver catalog.
 *
 * Reads xerenity.data_tables_meta + xerenity.data_slice_dictionary, builds
 * a "rich" text for each row (label + description + aliases), calls OpenAI
 * text-embedding-3-small (1536d), and writes back into the `embedding`
 * column via the service_role JWT (bypasses RLS).
 *
 * Idempotent: only embeds rows where embedding IS NULL, unless --force.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-...                           \
 *   NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=ey...                 \
 *   npx tsx scripts/populate-catalog-embeddings.ts [--force] [--limit N]
 *
 * Cost: ~$0.0001 per row at $0.02/1M tokens with text-embedding-3-small.
 *       ~150 rows → ~$0.0001 total. Bookkeeping cost dwarfs the actual.
 */

import { createClient } from '@supabase/supabase-js';

const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 100; // OpenAI accepts arrays up to 2048 inputs

interface CatalogRow {
  // Common shape across both tables
  table_name?: string;
  slice_value?: string | null;
  slice_column?: string | null;
  label: string | null;
  description: string | null;
  aliases: string[] | null;
}

function buildEmbeddingText(row: CatalogRow): string {
  const parts: string[] = [];
  if (row.label) parts.push(row.label);
  if (row.description) parts.push(row.description);
  if (row.aliases && row.aliases.length > 0) {
    parts.push('Sinónimos: ' + row.aliases.join(', '));
  }
  return parts.join(' — ');
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`OpenAI ${r.status}: ${err.slice(0, 500)}`);
  }
  const json = (await r.json()) as { data: { embedding: number[]; index: number }[] };
  // OpenAI returns in index order but guard anyway.
  const sorted = json.data.sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

function pgVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  const supa = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'xerenity' },
  });

  let totalEmbedded = 0;

  for (const tableName of ['data_tables_meta', 'data_slice_dictionary']) {
    console.log(`\n=== ${tableName} ===`);

    const query = supa.from(tableName).select('*');
    if (!force) query.is('embedding', null);

    const { data, error } = await query;
    if (error) {
      console.error(`Failed to read ${tableName}: ${error.message}`);
      continue;
    }
    if (!data || data.length === 0) {
      console.log(`  (nothing to embed; all rows already have embeddings, or --force omitted)`);
      continue;
    }

    const rowsToEmbed = data.slice(0, Math.min(data.length, limit - totalEmbedded));
    console.log(`  ${data.length} rows missing embedding, processing ${rowsToEmbed.length}`);

    for (let i = 0; i < rowsToEmbed.length; i += BATCH_SIZE) {
      const batch = rowsToEmbed.slice(i, i + BATCH_SIZE);
      const texts = batch.map(buildEmbeddingText);

      console.log(`  batch ${i / BATCH_SIZE + 1}: embedding ${batch.length} rows...`);
      let vectors: number[][];
      try {
        vectors = await embedBatch(texts, apiKey);
      } catch (e) {
        console.error(`  OpenAI call failed: ${(e as Error).message}`);
        continue;
      }

      // Update one by one (Supabase doesn't have native bulk update with
      // different values per row). 100 round-trips is fine for this scale.
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j] as Record<string, unknown>;
        const vec = vectors[j];
        const updatePayload = {
          embedding: pgVectorLiteral(vec),
          embedding_updated_at: new Date().toISOString(),
        };

        let upd;
        if (tableName === 'data_tables_meta') {
          upd = await supa
            .from(tableName)
            .update(updatePayload)
            .eq('table_name', row.table_name as string);
        } else {
          upd = await supa
            .from(tableName)
            .update(updatePayload)
            .eq('table_name', row.table_name as string)
            .eq('slice_column', row.slice_column as string)
            .eq('slice_value', row.slice_value as string);
        }

        if (upd.error) {
          console.error(
            `  update failed for ${row.table_name}${row.slice_value ? ' / ' + row.slice_value : ''}: ${upd.error.message}`,
          );
        } else {
          totalEmbedded++;
        }
      }
    }
  }

  console.log(`\nDone. Embedded ${totalEmbedded} rows.`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
