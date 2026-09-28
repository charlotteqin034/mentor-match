# Mentor–Mentee Matching

Pairs a club's mentors with its mentees, one round per semester. Three stages for
participants, one console for whoever's organising.

Built for ~25 + ~25 people. The scale is trivial; the point is that **every
scoring component is individually visible**, so the organiser can see *why* a
pair scored what it did and re-run with different weights before publishing.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) · TypeScript · Tailwind 4 |
| Database | Supabase (Postgres) via `@supabase/supabase-js` |
| Hosting | Vercel free tier |
| Matching | Hungarian / linear sum assignment (`munkres-js`) |
| Embeddings | Hugging Face Inference API — optional, off by default |

No paid services anywhere.

## Auth

- **Participants** don't log in. Each gets a link containing a random 32-character
  token: `/s/<token>` for the trait survey, `/r/<token>` for the ranking round.
- **Organiser** signs in at `/admin` with one password from `ADMIN_PASSWORD`,
  checked server-side; an HMAC-signed httpOnly cookie holds the session for 12
  hours. No Supabase Auth.
- The browser never talks to Supabase. Every read and write goes through a route
  handler holding the service role key, and RLS is on with no permissive policy,
  so a leaked anon key reads nothing.

---

## Setup

1. **Create a Supabase project** (free tier) and run `supabase/schema.sql` in the
   SQL editor.

2. **Configure the environment.** Copy `.env.example` to `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...      # service_role, not anon. Server-only.
   ADMIN_PASSWORD=...
   ADMIN_SESSION_SECRET=...           # openssl rand -hex 32
   ENABLE_EMBEDDINGS=false
   HUGGINGFACE_API_KEY=               # only if embeddings are on
   ```

3. **Run it.**

   ```
   npm install
   npm run dev        # http://localhost:3000/admin
   npm test           # 62 tests, no database needed
   ```

4. **Deploy.** Push to Vercel and set the same five variables in the project
   settings. `/admin/login` tells you if any are missing.

---

## Running a round

| Stage | What happens | Who |
|---|---|---|
| 1 | Trait survey — 28 questions | Everyone |
| 2 | Generate anonymised profile cards | Organiser |
| 3 | Ranking survey — each side ranks the other's cards | Everyone |
| 4 | Build the score matrix, tune weights, run Hungarian | Organiser |
| 5 | Review, override, publish | Organiser |

The round's `stage` field gates all of this. Stage 3 can't open before stage 1
closes, because the cards don't exist yet — anyone hitting the wrong URL gets a
"not open yet" page rather than a broken form.

**The order of operations:**

1. **Overview** → create a round.
2. **Participants** → paste `Name, email` lines (tabs work, so a spreadsheet
   paste is fine). Export the links CSV for a mail merge, or copy them one at a
   time. Nobody can look a link up by name; send them directly.
3. **Overview** → move the round to *Trait survey open*, send the `/s/` links.
4. When answers are in, move to *Profiles generated* and hit **Generate profile
   cards**. Safe to re-run: existing profile numbers are preserved, so links and
   already-submitted rankings stay valid.
5. Move to *Ranking survey open* and send the `/r/` links.
6. Move to *Matching*, then **Matching** → *Run matching*.
7. **Run history** → publish a run. Export the pairings CSV.

Ranking is genuinely optional. Matching does not wait for 100% completion — a
missing ranking just scores 0 on that one component.

---

## Scoring

Every component returns a value in `[0, 1]` *before* weighting, so the weights
are directly comparable. Default weights:

```ts
{ traits: 0.42, crossPref: 0.08, closeness: 0.25, values: 0.05, openText: 0.05, ranking: 0.15 }
```

| Component | Questions | How |
|---|---|---|
| **Trait similarity** | 21 scale questions | `1 − |a − b| / 4`, weighted mean |
| **Cross-preference** | q10 → q15 | The scales run opposite ways, so the hoped-for partner answer is `8 − mine`; both directions, averaged |
| **Closeness & logistics** | q23, q24, q25 | Same gap formula, own component, q23 weighted double — a light-touch mentor with a close-mentorship mentee is the most damaging mismatch there is |
| **Values overlap** | q26 | Jaccard index over the selected sets |
| **Open text** | q27 + q28 | Cosine similarity of embeddings. Excluded entirely when disabled |
| **Ranking** | ranking round | `(K − r + 1) / K`; mutual → average, one-sided → half credit, neither → 0 |

Every scale question runs 1–5. That range lives in `SCALE_MIN`/`SCALE_MAX` in
`src/lib/questions.ts` and everything else derives from it — the radio buttons,
the gap denominator, the cross-preference mirror, the profile-card midpoint. If
you change it, note that answers already in the database were recorded on the
old range and any now out of bounds read as unanswered.

**Missing components are excluded, not zeroed.** A `null` component drops out of
the weighted mean and the rest renormalise, so totals stay in `[0, 1]` whatever
is missing. Scoring everyone 0 would look harmless and quietly distort the
normalisation instead.

**Blocked pairs** get a score of `−1000`, not 0 — the optimiser must treat them
as forbidden, and it will happily accept a genuinely 0-scoring pair.

**Unequal cohorts** pad the matrix with dummy rows scoring 0, and the extra
people are reported as unmatched rather than paired badly.

### Tuning

The weight sliders on the Matching page re-score live once a run exists — drag
one and watch pairs move. That preview doesn't write anything; *Run matching*
and *Save as new run* do. Every saved run keeps the weights it used, so two
weightings can be compared side by side in Run history.

Per-question weights are also supported: add `weight` to any question in
`src/lib/questions.ts` to emphasise it inside its component.

### Manual override

The algorithm is a strong starting point, not gospel. On the Matching page,
*Swap* on two rows exchanges their mentees and shows the score delta immediately.
Save the result as a new run to publish it.

---

## The question bank

All 28 questions live in `src/lib/questions.ts` — text, anchors, scoring mode,
and the phrase pair used to build profile-card traits. Rendering, validation and
scoring all read from that one array; nothing is hardcoded in JSX. Adding or
reordering a question is a single edit.

Profile cards never contain a name, an email or a token. That anonymity is the
point of stage 2: rankings should respond to the person described, not to who
someone already knows.

---

## Layout

```
src/lib/
  questions.ts      the question bank — single source of truth
  scoring.ts        §8 pipeline, pure and fully unit-tested
  matching.ts       score matrix + Hungarian solve
  override.ts       manual swaps (kept apart so the solver stays server-side)
  profile-cards.ts  anonymised card generation
  validation.ts     isomorphic answer validation
  embeddings.ts     Hugging Face, feature-flagged, cached
  data.ts           every Supabase read in one place
src/app/
  s/[token]/        stage 1 — trait survey
  r/[token]/        stage 3 — ranking survey
  admin/            the console
  api/              route handlers
tests/
  scoring.test.ts   §13's fixtures, component by component
  matching.test.ts  blocked pairs, padding, 25×25 synthetic pipeline
  routes.test.ts    the whole organiser flow against an in-memory database
```

## Tests

```
npm test
```

62 tests, no database or network required. `tests/fake-supabase.ts` is an
in-memory stand-in for the slice of `supabase-js` this app uses, which lets
`routes.test.ts` drive the real route handlers through an entire round: create,
invite, survey, generate cards, rank, match, block, override, publish, export.

## Deliberately not built

Participant accounts, chat, email sending (the organiser sends links), mobile
apps, multi-club tenancy, real-time updates.
