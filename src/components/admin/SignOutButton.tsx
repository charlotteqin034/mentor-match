"use client";

import { useRouter } from "next/navigation";
import { post } from "@/lib/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-muted hover:text-ink"
      onClick={async () => {
        await post("/api/admin/logout", {});
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
