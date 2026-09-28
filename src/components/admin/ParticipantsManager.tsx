"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOrigin } from "@/lib/use-client-value";
import { errorMessage, post } from "@/lib/client";
import type { Participant } from "@/lib/types";

export function ParticipantsManager({
  roundId,
  participants,
}: {
  roundId: string;
  participants: Participant[];
}) {
  const router = useRouter();
  const origin = useOrigin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"big" | "little">("little");

  const [bulkText, setBulkText] = useState("");
  const [bulkRole, setBulkRole] = useState<"big" | "little">("little");

  async function run(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await post<{ added?: number; problems?: string[] }>(
        "/api/admin/participants",
        body,
      );
      if (res.added !== undefined) {
        setNotice(
          `Added ${res.added}.${
            res.problems?.length ? ` Skipped: ${res.problems.join(" ")}` : ""
          }`,
        );
      }
      after?.();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Clipboard blocked — the link is in the table, copy it by hand.");
    }
  }

  const link = (p: Participant, kind: "s" | "r") => `${origin}/${kind}/${p.token}`;

  return (
    <div className="space-y-6">
      <div className="card border-accent/40 bg-accent-soft p-4">
        <h2 className="text-sm font-semibold">The link to send everyone</h2>
        <p className="mt-1 text-xs text-muted">
          One link for the whole club. People pick their name from a list and go straight into
          whichever survey is open — no individual links to chase.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="flex-1 rounded-md border border-line bg-card px-3 py-2 font-mono text-sm">
            {origin || "…"}
          </code>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => copy(origin, "shared")}
          >
            {copied === "shared" ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Anyone with this link can see the list of names and pick any of them, so treat it as
          club-internal. The per-person links below still work if you&apos;d rather send someone
          a direct one.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className="card space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run({ action: "add", round_id: roundId, name, email, role }, () => {
              setName("");
              setEmail("");
            });
          }}
        >
          <h2 className="text-sm font-semibold">Add one person</h2>
          <input
            className="input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="flex gap-2">
            <select
              className="input w-auto"
              value={role}
              onChange={(e) => setRole(e.target.value as "big" | "little")}
            >
              <option value="little">Little</option>
              <option value="big">Big</option>
            </select>
            <button className="btn btn-primary" disabled={busy}>
              Add
            </button>
          </div>
        </form>

        <form
          className="card space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run({ action: "bulk", round_id: roundId, text: bulkText, role: bulkRole }, () =>
              setBulkText(""),
            );
          }}
        >
          <h2 className="text-sm font-semibold">Paste a list</h2>
          <p className="text-xs text-muted">
            One per line: <code>Name, email</code> — or{" "}
            <code>Name, email, big</code> to mix roles in one paste. Tabs work too, so you
            can paste straight from a spreadsheet.
          </p>
          <textarea
            className="input min-h-28 font-mono text-xs"
            placeholder={"Ada Lovelace, ada@example.com\nGrace Hopper, grace@example.com"}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div className="flex gap-2">
            <select
              className="input w-auto"
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value as "big" | "little")}
            >
              <option value="little">Default: little</option>
              <option value="big">Default: big</option>
            </select>
            <button className="btn btn-primary" disabled={busy || !bulkText.trim()}>
              Add all
            </button>
          </div>
        </form>
      </div>

      {notice && <p className="text-sm text-accent">{notice}</p>}
      {error && <p className="text-sm text-bad">{error}</p>}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">
            {participants.length} participant{participants.length === 1 ? "" : "s"}
          </h2>
          <a className="btn" href={`/api/admin/export?kind=links&round=${roundId}`}>
            Export links CSV
          </a>
        </div>

        {participants.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Nobody added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Links</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2">
                      {p.name}
                    </td>
                    <td className="px-4 py-2 text-muted">{p.email}</td>
                    <td className="px-4 py-2">
                      <select
                        className="rounded border border-line bg-card px-1.5 py-0.5 text-xs"
                        value={p.role}
                        disabled={busy}
                        onChange={(e) =>
                          run({
                            action: "set_role",
                            participant_id: p.id,
                            role: e.target.value,
                          })
                        }
                      >
                        <option value="little">little</option>
                        <option value="big">big</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn px-2 py-1 text-xs"
                          onClick={() => copy(link(p, "s"), `s-${p.id}`)}
                        >
                          {copied === `s-${p.id}` ? "Copied" : "Trait"}
                        </button>
                        <button
                          type="button"
                          className="btn px-2 py-1 text-xs"
                          onClick={() => copy(link(p, "r"), `r-${p.id}`)}
                        >
                          {copied === `r-${p.id}` ? "Copied" : "Ranking"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="btn px-2 py-1 text-xs"
                        disabled={busy}
                        title="Issue a new link and invalidate the old one"
                        onClick={() => run({ action: "regenerate_token", participant_id: p.id })}
                      >
                        New link
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger ml-1 px-2 py-1 text-xs"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Remove ${p.name} and all their answers?`))
                            run({ action: "delete", participant_id: p.id });
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
