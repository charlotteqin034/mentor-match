"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clearJson, readJson, useHydrated, writeJson } from "@/lib/use-client-value";
import { ProfileCardView } from "./ProfileCardView";
import type { ProfileCard } from "@/lib/profile-cards";

export type RankableCard = { participant_id: string; card: ProfileCard };

const MAX_RANKS = 8;
const draftKey = (token: string) => `mm:ranking-draft:${token}`;

export function RankingSurvey({
  token,
  name,
  role,
  cards,
  required,
  initialRanking,
  alreadyDone,
}: {
  token: string;
  name: string;
  role: "mentor" | "mentee";
  cards: RankableCard[];
  required: number;
  initialRanking: string[];
  alreadyDone: boolean;
}) {
  const [shortlist, setShortlist] = useState<string[]>(initialRanking);
  const [editing, setEditing] = useState(!alreadyDone);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const [draftChecked, setDraftChecked] = useState(false);
  const hydrated = useHydrated();
  const dragIndex = useRef<number | null>(null);

  const byId = useMemo(
    () => new Map(cards.map((c) => [c.participant_id, c.card])),
    [cards],
  );

  // Restore an unsent shortlist during the first client render, dropping anyone
  // who has since been removed from the round.
  if (hydrated && !draftChecked) {
    setDraftChecked(true);
    const draft = readJson<string[]>(draftKey(token));
    if (draft) setShortlist(draft.filter((id) => cards.some((c) => c.participant_id === id)));
  }

  useEffect(() => {
    if (!draftChecked) return;
    writeJson(draftKey(token), shortlist);
  }, [shortlist, draftChecked, token]);

  const toggle = (id: string) => {
    setShortlist((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_RANKS) return prev;
      return [...prev, id];
    });
  };

  const move = (from: number, to: number) => {
    setShortlist((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  async function submit() {
    setStatus("saving");
    setErrorText("");
    const res = await fetch("/api/rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ranked: shortlist }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus("error");
      setErrorText(body.error ?? "Something went wrong. Try again in a moment.");
      return;
    }
    clearJson(draftKey(token));
    setStatus("idle");
    setEditing(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!editing) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <div className="card p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">All done</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Your shortlist is in, {name.split(" ")[0]}.
          </h1>
          <p className="mt-3 text-sm text-muted">
            Rankings are one signal among several, so nothing here is a guarantee — but they do
            move the needle. You&apos;ll hear who you&apos;ve been paired with from the organiser.
          </p>
          <ol className="mt-5 space-y-1 text-sm">
            {shortlist.map((id, i) => (
              <li key={id} className="flex gap-2">
                <span className="w-5 text-right text-faint">{i + 1}.</span>
                <span>Profile #{byId.get(id)?.display_number}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="btn mt-6" onClick={() => setEditing(true)}>
            Change my ranking
          </button>
        </div>
      </div>
    );
  }

  const enough = shortlist.length >= required;
  const otherSide = role === "mentor" ? "mentees" : "mentors";

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10">
      <header className="max-w-prose">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          {role === "mentor" ? "Mentor" : "Mentee"} · ranking round
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Which of these {otherSide} would you want, {name.split(" ")[0]}?
        </h1>
        <p className="mt-3 text-muted">
          These are the {otherSide} in this round, anonymised — no names, deliberately. Click
          to add someone to your shortlist, then drag to put them in order. Pick at least{" "}
          {required}, up to {MAX_RANKS}.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ participant_id, card }) => {
            const position = shortlist.indexOf(participant_id);
            return (
              <button
                key={participant_id}
                type="button"
                onClick={() => toggle(participant_id)}
                className="text-left"
                aria-pressed={position >= 0}
              >
                <ProfileCardView
                  card={card}
                  selected={position >= 0}
                  action={
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                        position >= 0
                          ? "border-accent bg-accent text-white"
                          : "border-line text-faint"
                      }`}
                    >
                      {position >= 0 ? position + 1 : "+"}
                    </span>
                  }
                />
              </button>
            );
          })}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="card p-4">
            <h2 className="text-sm font-semibold">
              Your shortlist{" "}
              <span className="font-normal text-muted">
                ({shortlist.length}/{MAX_RANKS})
              </span>
            </h2>

            {shortlist.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Nothing picked yet. Click a card to add it here.
              </p>
            ) : (
              <ol className="mt-3 space-y-1.5">
                {shortlist.map((id, index) => (
                  <li
                    key={id}
                    draggable
                    onDragStart={() => (dragIndex.current = index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex.current !== null) move(dragIndex.current, index);
                      dragIndex.current = null;
                    }}
                    className="flex cursor-grab items-center gap-2 rounded-md border border-line bg-paper px-2 py-1.5 text-sm active:cursor-grabbing"
                  >
                    <span className="w-4 text-right text-xs text-faint">{index + 1}</span>
                    <span className="flex-1">Profile #{byId.get(id)?.display_number}</span>
                    <span className="flex gap-0.5">
                      <button
                        type="button"
                        aria-label="Move up"
                        className="px-1 text-faint hover:text-ink disabled:opacity-30"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        className="px-1 text-faint hover:text-ink disabled:opacity-30"
                        disabled={index === shortlist.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label="Remove"
                        className="px-1 text-faint hover:text-bad"
                        onClick={() => toggle(id)}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <p className="mt-3 text-xs text-muted">
              {enough
                ? "Ready to submit."
                : `${required - shortlist.length} more to go before you can submit.`}
            </p>

            <button
              type="button"
              className="btn btn-primary mt-3 w-full"
              disabled={!enough || status === "saving"}
              onClick={submit}
            >
              {status === "saving" ? "Saving…" : "Submit ranking"}
            </button>
            {errorText && <p className="mt-2 text-sm text-bad">{errorText}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
