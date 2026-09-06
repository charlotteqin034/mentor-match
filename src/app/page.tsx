import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        Mentor–Mentee Matching
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        You should have arrived here from a link.
      </h1>
      <p className="mt-4 text-muted">
        Every participant gets their own private link to the trait survey and, once that
        closes, to the ranking round. If you&apos;ve lost yours, ask whoever is organising
        this to send it again — the links can&apos;t be looked up by name.
      </p>
      <div className="mt-8">
        <Link href="/admin" className="btn">
          Organiser console
        </Link>
      </div>
    </main>
  );
}
