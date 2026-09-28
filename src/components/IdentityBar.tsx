"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "@/lib/client";

/** "You're filling this in as X" — plus a way out on a shared device. */
export function IdentityBar({ name }: { name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-2 text-xs">
        <span className="text-muted">
          Filling this in as <span className="font-semibold text-ink">{name}</span>
        </span>
        <button
          type="button"
          className="text-accent underline underline-offset-2 hover:no-underline disabled:opacity-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await post("/api/join", { action: "leave" });
            router.replace("/");
            router.refresh();
          }}
        >
          Not you?
        </button>
      </div>
    </div>
  );
}
