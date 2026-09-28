"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, post } from "@/lib/client";

export type PickerPerson = {
  id: string;
  name: string;
  role: "mentor" | "mentee";
  done: boolean;
};

export function NamePicker({
  people,
  actionLabel,
  returning,
}: {
  people: PickerPerson[];
  actionLabel: string;
  returning: { name: string; next: string } | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const mentors = people.filter((p) => p.role === "mentor");
  const mentees = people.filter((p) => p.role === "mentee");

  async function go(participantId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await post<{ next: string }>("/api/join", { participant_id: participantId });
      router.push(res.next);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function switchUser() {
    setBusy(true);
    await post("/api/join", { action: "leave" });
    router.refresh();
    setBusy(false);
  }

  if (returning) {
    return (
      <div>
        <p className="text-sm text-muted">
          Last time you were here you picked{" "}
          <span className="font-semibold text-ink">{returning.name}</span>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => router.push(returning.next)}
          >
            Continue as {returning.name.split(" ")[0]}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={switchUser}>
            I&apos;m someone else
          </button>
        </div>
      </div>
    );
  }

  const group = (label: string, list: PickerPerson[]) =>
    list.length > 0 && (
      <optgroup label={label}>
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.done ? " — already submitted" : ""}
          </option>
        ))}
      </optgroup>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (selected) void go(selected);
      }}
    >
      <label htmlFor="who" className="label">
        Find your name
      </label>
      <select
        id="who"
        className="input mt-1"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={busy}
      >
        <option value="">Choose your name…</option>
        {group("Mentors", mentors)}
        {group("Mentees", mentees)}
      </select>

      <button type="submit" className="btn btn-primary mt-4 w-full" disabled={!selected || busy}>
        {busy ? "One moment…" : actionLabel}
      </button>

      {error && <p className="mt-3 text-sm text-bad">{error}</p>}

      <p className="mt-4 text-xs text-faint">
        Can&apos;t find yourself? You may not have been added to this round yet — ask whoever
        is organising it.
      </p>
    </form>
  );
}
