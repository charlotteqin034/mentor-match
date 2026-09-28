"use client";

import { useMemo, useRef, useState } from "react";

export type Candidate = { id: string; name: string };

/**
 * Type-ahead over the other side's roster. Multi-select, optional, and it only
 * shows suggestions once something is typed — a list of everyone's names
 * sitting open on the page invites browsing rather than answering.
 */
export function PeoplePicker({
  candidates,
  value,
  onChange,
  placeholder,
  max,
}: {
  candidates: Candidate[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  max: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const full = value.length >= max;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return candidates
      .filter((c) => !value.includes(c.id) && c.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [candidates, query, value]);

  function add(id: string) {
    if (value.includes(id) || full) return;
    onChange([...value, id]);
    setQuery("");
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      add(matches[active].id);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((id) => (
            <li
              key={id}
              className="flex items-center gap-1.5 rounded-full border border-accent bg-accent px-3 py-1 text-sm text-white"
            >
              {byId.get(id)?.name ?? "(removed)"}
              <button
                type="button"
                aria-label={`Remove ${byId.get(id)?.name ?? "person"}`}
                className="text-white/70 hover:text-white"
                onClick={() => onChange(value.filter((x) => x !== id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="relative">
          <input
            ref={inputRef}
            className="input"
            placeholder={placeholder}
            value={query}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
          />
          {open && matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-line bg-card shadow-sm">
              {matches.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 text-left text-sm ${
                      i === active ? "bg-accent-soft" : "hover:bg-paper"
                    }`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(c.id)}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && query.trim() && matches.length === 0 && (
            <p className="absolute z-10 mt-1 w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-muted">
              Nobody by that name in this round.
            </p>
          )}
        </div>
      )}

      {full && <p className="text-xs text-faint">That&apos;s the maximum of {max}.</p>}
    </div>
  );
}
