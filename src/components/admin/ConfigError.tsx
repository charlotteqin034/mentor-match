export function ConfigError({ message }: { message: string }) {
  return (
    <div className="card border-bad/40 bg-bad-soft p-6">
      <h2 className="text-sm font-semibold text-bad">Couldn&apos;t reach the database</h2>
      <p className="mt-2 text-sm text-bad/90">{message}</p>
      <p className="mt-3 text-xs text-bad/80">
        Check <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code>SUPABASE_SERVICE_ROLE_KEY</code>, and make sure{" "}
        <code>supabase/schema.sql</code> has been run.
      </p>
    </div>
  );
}
