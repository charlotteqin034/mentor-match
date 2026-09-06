/** Full-page message for links that are valid but not usable right now. */
export function Gate({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <div className="card p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{eyebrow}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-3 space-y-3 text-sm text-muted">{children}</div>
      </div>
    </main>
  );
}
