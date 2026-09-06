import "server-only";
import { createHash } from "node:crypto";
import { env } from "./env";
import { db } from "./supabase";
import type { Answers } from "./scoring";

/**
 * Open-text embeddings (§8e) — entirely optional.
 *
 * When ENABLE_EMBEDDINGS is not "true", `loadEmbeddings` returns an empty map,
 * every openText component comes out null, and the weights renormalise around
 * it. Nothing else in the pipeline knows or cares.
 */

const MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const ENDPOINT = `https://router.huggingface.co/hf-inference/models/${MODEL}/pipeline/feature-extraction`;

export function openTextOf(answers: Answers | null): string {
  if (!answers) return "";
  const q27 = typeof answers.q27 === "string" ? answers.q27 : "";
  const q28 = typeof answers.q28 === "string" ? answers.q28 : "";
  return `${q27}\n${q28}`.trim();
}

export function textHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/** Some HF pipelines return token-level vectors; average them into one. */
function flatten(vector: unknown): number[] | null {
  if (!Array.isArray(vector)) return null;
  if (typeof vector[0] === "number") return vector as number[];
  const rows = vector as number[][];
  if (!Array.isArray(rows[0])) return null;
  const dims = rows[0].length;
  const out = new Array<number>(dims).fill(0);
  for (const row of rows) for (let i = 0; i < dims; i++) out[i] += row[i];
  return out.map((x) => x / rows.length);
}

async function callHuggingFace(texts: string[]): Promise<number[][]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.huggingFaceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
  });
  if (!res.ok) {
    throw new Error(`Hugging Face returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) throw new Error("Unexpected embedding response shape.");
  return json.map((v, i) => {
    const flat = flatten(v);
    if (!flat) throw new Error(`Unexpected embedding shape at index ${i}.`);
    return flat;
  });
}

/**
 * Returns participant id → embedding, batching every uncached text into one
 * API call and writing the results to `text_embeddings` so re-runs are free.
 */
export async function loadEmbeddings(
  people: { id: string; answers: Answers | null }[],
  enabled = env.embeddingsEnabled,
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (!enabled || !env.huggingFaceKey) return out;

  const wanted = people
    .map((p) => ({ id: p.id, text: openTextOf(p.answers) }))
    .filter((p) => p.text.length > 0)
    .map((p) => ({ ...p, hash: textHash(p.text) }));
  if (wanted.length === 0) return out;

  const client = db();
  const { data: cached } = await client
    .from("text_embeddings")
    .select("participant_id, text_hash, embedding")
    .in(
      "participant_id",
      wanted.map((w) => w.id),
    );

  const cache = new Map((cached ?? []).map((r) => [`${r.participant_id}:${r.text_hash}`, r.embedding as number[]]));

  const missing = wanted.filter((w) => !cache.has(`${w.id}:${w.hash}`));
  for (const w of wanted) {
    const hit = cache.get(`${w.id}:${w.hash}`);
    if (hit) out.set(w.id, hit);
  }

  if (missing.length > 0) {
    const vectors = await callHuggingFace(missing.map((m) => m.text));
    const rows = missing.map((m, i) => ({
      participant_id: m.id,
      text_hash: m.hash,
      embedding: vectors[i],
    }));
    for (const row of rows) out.set(row.participant_id, row.embedding);
    await client.from("text_embeddings").upsert(rows, { onConflict: "participant_id,text_hash" });
  }

  return out;
}
