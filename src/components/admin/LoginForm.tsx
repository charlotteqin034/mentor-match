"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, post } from "@/lib/client";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await post("/api/admin/login", { password });
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <input
        className="input"
        type="password"
        autoFocus
        placeholder="Admin password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>
      {error && <p className="text-sm text-bad">{error}</p>}
    </form>
  );
}
