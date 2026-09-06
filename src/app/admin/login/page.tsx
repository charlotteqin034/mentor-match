import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { missingEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const missing = missingEnv();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Organiser console
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Sign in</h1>
        {missing.length > 0 && (
          <div className="mt-4 rounded-md border border-warn/30 bg-warn-soft p-3 text-xs text-warn">
            <p className="font-semibold">Not fully configured</p>
            <p className="mt-1">Missing: {missing.join(", ")}</p>
          </div>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
