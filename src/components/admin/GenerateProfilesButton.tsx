"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, post } from "@/lib/client";

export function GenerateProfilesButton({ roundId }: { roundId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ generated: number; missing: string[] } | null>(null);
  const [error, setError] = useState("");

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const res = await post<{ generated: number; missing: string[] }>(
              "/api/admin/profiles",
              { round_id: roundId },
            );
            setResult(res);
            router.refresh();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Generating…" : "Generate profile cards"}
      </button>

      {result && (
        <p className="mt-2 text-xs text-muted">
          {result.generated} card{result.generated === 1 ? "" : "s"} built.
          {result.missing.length > 0 && (
            <>
              {" "}
              Skipped {result.missing.length} with no trait response:{" "}
              <span className="text-warn">{result.missing.join(", ")}</span>
            </>
          )}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
