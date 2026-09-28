"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessage, post } from "@/lib/client";
import type { MatchResult, MatchedPair } from "@/lib/matching";
import { swapPairs } from "@/lib/override";
import {
  DEFAULT_WEIGHTS,
  WEIGHT_KEYS,
  WEIGHT_LABELS,
  type WeightKey,
  type Weights,
} from "@/lib/scoring";
import { ComponentBar, ComponentLegend } from "./ComponentBar";
import { WeightSliders } from "./WeightSliders";

type Person = {
  id: string;
  name: string;
  email: string;
  role: "big" | "little";
  display_number: number | null;
  trait_completed: boolean;
  ranking_completed: boolean;
};

type MatchResponse = {
  run_id: string | null;
  weights: Weights;
  embeddings_used: boolean;
  restricted: boolean;
  result: MatchResult;
  people: Person[];
};

type SortKey = "score" | "big" | "little" | "fit";

export function MatchingConsole({
  roundId,
  embeddingsDefault,
  hasEmbeddingKey,
  publishedRunId,
}: {
  roundId: string;
  embeddingsDefault: boolean;
  hasEmbeddingKey: boolean;
  publishedRunId: string | null;
}) {
  const router = useRouter();
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS });
  const [embeddings, setEmbeddings] = useState(embeddingsDefault);
  const [restrict, setRestrict] = useState(false);
  const [data, setData] = useState<MatchResponse | null>(null);
  const [pairs, setPairs] = useState<MatchedPair[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sort, setSort] = useState<SortKey>("score");
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [edited, setEdited] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    async (
      persist: boolean,
      nextWeights: Weights,
      useEmbeddings: boolean,
      restrictToShortlists: boolean,
    ) => {
      setBusy(true);
      setError("");
      try {
        const res = await post<MatchResponse>("/api/admin/match", {
          round_id: roundId,
          weights: nextWeights,
          persist,
          embeddings: useEmbeddings,
          restrict_to_shortlists: restrictToShortlists,
        });
        setData(res);
        setPairs(res.result.pairs);
        setEdited(false);
        setSwapFrom(null);
        setLastDelta(null);
        if (persist) {
          setNotice("Run saved to history.");
          router.refresh();
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [roundId, router],
  );

  // Live sliders: once a run exists, dragging re-scores without saving.
  useEffect(() => {
    if (!data) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const same = WEIGHT_KEYS.every((k) => data.weights[k] === weights[k]);
      if (same && data.embeddings_used === embeddings && data.restricted === restrict) return;
      void run(false, weights, embeddings, restrict);
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // `data` is intentionally excluded: it changes as a result of the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weights, embeddings, restrict]);

  const people = useMemo(
    () => new Map((data?.people ?? []).map((p) => [p.id, p])),
    [data],
  );

  /** Which components are live at all — drives the legend's strike-throughs. */
  const liveComponents = useMemo<Record<WeightKey, number>>(
    () =>
      Object.fromEntries(
        WEIGHT_KEYS.map((key) => [
          key,
          pairs.some((p) => p.components[key] !== null) ? weights[key] : 0,
        ]),
      ) as Record<WeightKey, number>,
    [pairs, weights],
  );

  const order = useMemo(() => {
    const indices = pairs.map((_, i) => i);
    const name = (id: string) => people.get(id)?.name ?? "";
    indices.sort((a, b) => {
      switch (sort) {
        case "big":
          return name(pairs[a].big_id).localeCompare(name(pairs[b].big_id));
        case "little":
          return name(pairs[a].little_id).localeCompare(name(pairs[b].little_id));
        case "fit":
          return pairs[b].big_rank_of_little - pairs[a].big_rank_of_little;
        default:
          return pairs[a].total - pairs[b].total; // weakest first — those need the eyeballs
      }
    });
    return indices;
  }, [pairs, sort, people]);

  const totalScore = pairs.reduce((s, p) => s + p.total, 0);
  const average = pairs.length ? totalScore / pairs.length : 0;
  const blockedAssigned = pairs.filter((p) => p.blocked);

  async function saveEdited() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      await post("/api/admin/runs", { round_id: roundId, weights, pairs });
      setNotice("Saved this arrangement as a new run.");
      setEdited(false);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleSwap(index: number) {
    if (!data) return;
    if (swapFrom === null) {
      setSwapFrom(index);
      return;
    }
    if (swapFrom === index) {
      setSwapFrom(null);
      return;
    }
    const { pairs: next, delta } = swapPairs(data.result, pairs, swapFrom, index);
    setPairs(next);
    setLastDelta(delta);
    setSwapFrom(null);
    setEdited(true);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <div className="space-y-4">
        <WeightSliders weights={weights} onChange={setWeights} disabled={busy} />

        <div className="card p-4">
          <h2 className="text-sm font-semibold">Open-text embeddings</h2>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-accent"
              checked={embeddings}
              onChange={(e) => setEmbeddings(e.target.checked)}
            />
            Score q27 + q28 with embeddings
          </label>
          <p className="mt-2 text-xs text-muted">
            {hasEmbeddingKey
              ? "Calls Hugging Face once per changed answer and caches the vectors. Off by default; everything works without it."
              : "No HUGGINGFACE_API_KEY is set, so this stays off — the open-text component is excluded and the other weights renormalise."}
          </p>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold">Shortlists</h2>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-accent"
              checked={restrict}
              onChange={(e) => setRestrict(e.target.checked)}
            />
            Only pair people who shortlisted each other
          </label>
          <p className="mt-2 text-xs text-muted">
            Off by default. A shortlist-only assignment often has no perfect matching — six
            littles can share the same five bigs — and the optimiser then has to force a pair
            nobody shortlisted. Any it forces show up flagged below.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={busy}
          onClick={() => run(true, weights, embeddings, restrict)}
        >
          {busy ? "Working…" : data ? "Re-run and save" : "Run matching"}
        </button>

        {error && <p className="text-sm text-bad">{error}</p>}
        {notice && !error && <p className="text-sm text-accent">{notice}</p>}
      </div>

      <div className="space-y-4">
        {!data ? (
          <div className="card p-8 text-sm text-muted">
            <p className="font-medium text-ink">Nothing run yet.</p>
            <p className="mt-2">
              Hit <strong>Run matching</strong> to build the full big × little matrix and
              solve it. Afterwards the sliders re-score live, so you can watch pairs move before
              committing to anything.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Pairs" value={String(pairs.length)} />
              <Stat label="Average score" value={average.toFixed(3)} />
              <Stat label="Total" value={totalScore.toFixed(2)} />
              <Stat
                label="Weakest pair"
                value={pairs.length ? Math.min(...pairs.map((p) => p.total)).toFixed(3) : "—"}
              />
            </div>

            {(data.result.unmatched_bigs.length > 0 ||
              data.result.unmatched_littles.length > 0) && (
              <div className="card border-warn/40 bg-warn-soft p-4 text-sm text-warn">
                <p className="font-semibold">Left unmatched</p>
                <p className="mt-1">
                  {[...data.result.unmatched_bigs, ...data.result.unmatched_littles]
                    .map((id) => people.get(id)?.name ?? id)
                    .join(", ")}{" "}
                  — the cohorts aren&apos;t the same size, so these people have nobody to pair
                  with.
                </p>
              </div>
            )}

            {blockedAssigned.length > 0 && (
              <div className="card border-bad/40 bg-bad-soft p-4 text-sm text-bad">
                <p className="font-semibold">
                  {blockedAssigned.length} pair
                  {blockedAssigned.length === 1 ? " was" : "s were"} forced
                </p>
                <p className="mt-1">
                  {restrict
                    ? "These pairs weren't on either person's shortlist, but there was no legal alternative — the shortlists don't admit a perfect matching. Either accept these, widen the shortlists, or untick the restriction."
                    : "These pairs are on the blocked list. That only happens when there was no legal alternative — unblock someone or add a participant."}
                </p>
              </div>
            )}

            {edited && (
              <div className="card border-accent/40 bg-accent-soft p-4 text-sm">
                <p className="font-medium">You&apos;ve hand-edited this arrangement.</p>
                <p className="mt-1 text-muted">
                  {lastDelta !== null && (
                    <>
                      Last swap changed the total by{" "}
                      <strong className={lastDelta < 0 ? "text-bad" : "text-accent"}>
                        {lastDelta >= 0 ? "+" : ""}
                        {lastDelta.toFixed(3)}
                      </strong>
                      .{" "}
                    </>
                  )}
                  Save it as a run if you want to keep or publish it.
                </p>
                <button type="button" className="btn mt-3" disabled={busy} onClick={saveEdited}>
                  Save as new run
                </button>
              </div>
            )}

            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                <ComponentLegend applied={liveComponents} />
                <label className="flex items-center gap-2 text-xs text-muted">
                  Sort
                  <select
                    className="rounded border border-line bg-card px-1.5 py-1 text-xs"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                  >
                    <option value="score">Weakest pairs first</option>
                    <option value="fit">Worst fit rank first</option>
                    <option value="big">Big name</option>
                    <option value="little">Little name</option>
                  </select>
                </label>
              </div>

              <table className="w-full text-sm">
                <tbody>
                  {order.map((index) => {
                    const pair = pairs[index];
                    const big = people.get(pair.big_id);
                    const little = people.get(pair.little_id);
                    const isOpen = expanded === index;
                    return (
                      <tr key={`${pair.big_id}-${pair.little_id}`} className="align-top">
                        <td colSpan={5} className="border-b border-line/60 px-4 py-2.5">
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              className="flex flex-1 items-center gap-3 text-left"
                              onClick={() => setExpanded(isOpen ? null : index)}
                            >
                              <PairName person={big} />
                              <span className="text-faint">+</span>
                              <PairName person={little} />
                            </button>

                            <span className="w-40">
                              <ComponentBar components={pair.components} applied={pair.applied} />
                            </span>
                            <span className="w-14 text-right font-semibold tabular-nums">
                              {pair.total.toFixed(3)}
                            </span>
                            <span
                              className="w-24 text-right text-xs tabular-nums text-muted"
                              title="Where this little ranked among all littles for this big"
                            >
                              #{pair.big_rank_of_little} / {data.result.little_ids.length}
                            </span>
                            <button
                              type="button"
                              className={`btn px-2 py-1 text-xs ${
                                swapFrom === index ? "btn-primary" : ""
                              }`}
                              onClick={() => handleSwap(index)}
                            >
                              {swapFrom === index
                                ? "Pick a partner…"
                                : swapFrom === null
                                  ? "Swap"
                                  : "Swap with this"}
                            </button>
                          </div>

                          {isOpen && (
                            <div className="mt-3 grid gap-3 rounded-md bg-paper p-3 sm:grid-cols-2 lg:grid-cols-3">
                              {WEIGHT_KEYS.map((key) => {
                                const value = pair.components[key];
                                const weight = pair.applied[key] ?? 0;
                                return (
                                  <div key={key} className="text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-muted">{WEIGHT_LABELS[key]}</span>
                                      <span className="tabular-nums">
                                        {value === null ? "excluded" : value.toFixed(3)}
                                      </span>
                                    </div>
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-line">
                                      <div
                                        className="h-full bg-accent"
                                        style={{ width: `${(value ?? 0) * 100}%` }}
                                      />
                                    </div>
                                    <p className="mt-0.5 text-faint">
                                      weight {weight.toFixed(2)} → contributes{" "}
                                      {((value ?? 0) * weight).toFixed(3)}
                                    </p>
                                  </div>
                                );
                              })}
                              <div className="text-xs text-muted sm:col-span-2 lg:col-span-3">
                                {big?.name} was this little&apos;s #
                                {pair.little_rank_of_big} option of{" "}
                                {data.result.big_ids.length}.
                                {(!big?.ranking_completed || !little?.ranking_completed) && (
                                  <>
                                    {" "}
                                    {[
                                      !big?.ranking_completed ? big?.name : null,
                                      !little?.ranking_completed ? little?.name : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" and ")}{" "}
                                    didn&apos;t submit a ranking, so that component scores 0 for
                                    them.
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted">
              {publishedRunId
                ? "A run is already published for this round. Publishing another replaces it."
                : "Nothing published yet. Save a run, then publish it from Run history."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Flags someone with no trait response — their empty bar needs an explanation. */
function PairName({ person }: { person: Person | undefined }) {
  return (
    <span className="flex w-48 items-center gap-1.5">
      <span className="truncate font-medium">{person?.name}</span>
      {person && !person.trait_completed && (
        <span
          className="shrink-0 rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-medium text-warn"
          title="No trait survey response — every trait component is excluded for this pair"
        >
          no survey
        </span>
      )}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="label">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
