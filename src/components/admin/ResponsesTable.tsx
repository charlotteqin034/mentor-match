"use client";

import { useMemo, useState } from "react";
import { AnswerList } from "./AnswerList";
import { ProfileCardView } from "@/components/ProfileCardView";
import type { ProfileCard } from "@/lib/profile-cards";

export type ResponseRow = {
  id: string;
  name: string;
  email: string;
  role: "mentor" | "mentee";
  display_number: number | null;
  submitted_at: string | null;
  answers: Record<string, unknown> | null;
  card: ProfileCard | null;
};

export function ResponsesTable({ rows }: { rows: ResponseRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [role, setRole] = useState<"all" | "mentor" | "mentee">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (role !== "all" && r.role !== role) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
    });
  }, [rows, role, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          className="input w-56"
          placeholder="Search name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input w-auto"
          value={role}
          onChange={(e) => setRole(e.target.value as "all" | "mentor" | "mentee")}
        >
          <option value="all">Both roles</option>
          <option value="mentor">Mentors</option>
          <option value="mentee">Mentees</option>
        </select>
        <span className="self-center text-xs text-muted">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="card divide-y divide-line/60 overflow-hidden">
        {filtered.length === 0 && <p className="px-4 py-6 text-sm text-muted">Nothing matches.</p>}
        {filtered.map((row) => {
          const isOpen = open === row.id;
          return (
            <div key={row.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-paper"
                onClick={() => setOpen(isOpen ? null : row.id)}
              >
                <span className="w-5 text-xs text-faint">{isOpen ? "▾" : "▸"}</span>
                <span className="flex-1 font-medium">{row.name}</span>
                <span className="w-16 text-xs text-muted">{row.role}</span>
                <span className="w-16 text-right text-xs tabular-nums text-faint">
                  {row.display_number ? `#${row.display_number}` : "—"}
                </span>
                <span className="w-24 text-right text-xs">
                  {row.submitted_at ? (
                    <span className="text-accent">submitted</span>
                  ) : (
                    <span className="text-faint">no response</span>
                  )}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-line/60 bg-paper px-4 py-4">
                  {row.answers ? (
                    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                      <AnswerList answers={row.answers} />
                      <div>
                        <p className="label mb-2">Profile card preview</p>
                        {row.card ? (
                          <ProfileCardView card={row.card} showRole />
                        ) : (
                          <p className="text-sm text-muted">
                            Not generated yet — run &ldquo;Generate profile cards&rdquo; on the
                            overview.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      {row.name} hasn&apos;t submitted the trait survey. They can still be
                      matched, but every trait component will be excluded for them.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
