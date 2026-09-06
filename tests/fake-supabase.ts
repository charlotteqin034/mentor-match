/**
 * An in-memory stand-in for the slice of supabase-js this app actually uses.
 *
 * Enough of the query builder to drive the real route handlers end to end in
 * a test — which is what catches column typos, stage gating and upsert
 * semantics that pure unit tests never touch.
 */

type Row = Record<string, unknown>;
type Op = "select" | "insert" | "update" | "upsert" | "delete";

const TABLES = [
  "rounds",
  "participants",
  "trait_responses",
  "profile_cards",
  "rankings",
  "blocked_pairs",
  "match_runs",
  "text_embeddings",
] as const;

const PRIMARY_KEY: Record<string, string> = {
  rounds: "id",
  participants: "id",
  trait_responses: "participant_id",
  profile_cards: "participant_id",
  rankings: "id",
  blocked_pairs: "id",
  match_runs: "id",
  text_embeddings: "participant_id",
};

const DEFAULTS: Record<string, () => Row> = {
  rounds: () => ({ stage: "setup", published_run_id: null }),
  participants: () => ({
    display_number: null,
    trait_completed_at: null,
    ranking_completed_at: null,
  }),
  trait_responses: () => ({ submitted_at: new Date().toISOString() }),
  profile_cards: () => ({ generated_at: new Date().toISOString() }),
  rankings: () => ({ submitted_at: new Date().toISOString() }),
  blocked_pairs: () => ({}),
  match_runs: () => ({ total_score: null }),
  text_embeddings: () => ({}),
};

export class FakeSupabase {
  tables: Record<string, Row[]> = {};
  private counter = 0;

  constructor() {
    for (const t of TABLES) this.tables[t] = [];
  }

  private id() {
    this.counter += 1;
    return `id-${String(this.counter).padStart(4, "0")}`;
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  /** Called by FakeQuery — kept here so ids and constraints live in one place. */
  insertRows(table: string, payload: Row | Row[]): { data: Row[] | null; error: Error | null } {
    const rows = Array.isArray(payload) ? payload : [payload];
    const created: Row[] = [];
    for (const row of rows) {
      const pk = PRIMARY_KEY[table];
      const full: Row = {
        ...DEFAULTS[table]?.(),
        [pk]: row[pk] ?? this.id(),
        created_at: new Date().toISOString(),
        ...row,
      };
      if (table === "participants") {
        const clash = this.tables[table].some(
          (r) =>
            r.round_id === full.round_id &&
            String(r.email).toLowerCase() === String(full.email).toLowerCase(),
        );
        if (clash) {
          return {
            data: null,
            error: new Error(
              'duplicate key value violates unique constraint "participants_round_email_idx"',
            ),
          };
        }
      }
      this.tables[table].push(full);
      created.push(full);
    }
    return { data: created, error: null };
  }
}

type Filter = { column: string; op: "eq" | "in"; value: unknown };

class FakeQuery implements PromiseLike<{ data: unknown; error: Error | null }> {
  private op: Op = "select";
  private payload: Row | Row[] = {};
  private filters: Filter[] = [];
  private conflictKey: string | null = null;
  private wantsSelect = false;
  private singleMode: "one" | "maybe" | null = null;
  private orderColumn: string | null = null;
  private ascending = true;

  constructor(
    private store: FakeSupabase,
    private table: string,
  ) {}

  select(columns?: string) {
    void columns; // Column lists don't matter here — rows always come back whole.
    this.wantsSelect = true;
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.payload = payload;
    this.wantsSelect = false;
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: Row | Row[], options?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = payload;
    this.conflictKey = options?.onConflict ?? PRIMARY_KEY[this.table];
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push({ column, op: "eq", value });
    return this;
  }
  in(column: string, value: unknown[]) {
    this.filters.push({ column, op: "in", value });
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.ascending = options?.ascending ?? true;
    return this;
  }
  single() {
    this.singleMode = "one";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) =>
      f.op === "eq"
        ? row[f.column] === f.value
        : Array.isArray(f.value) && f.value.includes(row[f.column]),
    );
  }

  private run(): { data: unknown; error: Error | null } {
    const rows = this.store.tables[this.table];
    if (!rows) return { data: null, error: new Error(`relation "${this.table}" does not exist`) };

    let result: Row[] = [];

    if (this.op === "insert") {
      const { data, error } = this.store.insertRows(this.table, this.payload);
      if (error) return { data: null, error };
      result = data ?? [];
    } else if (this.op === "upsert") {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
      const keys = (this.conflictKey ?? PRIMARY_KEY[this.table]).split(",").map((k) => k.trim());
      for (const row of incoming) {
        const existing = rows.find((r) => keys.every((k) => r[k] === row[k]));
        if (existing) Object.assign(existing, row);
        else {
          const { error } = this.store.insertRows(this.table, row);
          if (error) return { data: null, error };
        }
      }
      result = incoming;
    } else if (this.op === "update") {
      result = rows.filter((r) => this.matches(r));
      for (const row of result) Object.assign(row, this.payload as Row);
    } else if (this.op === "delete") {
      const keep = rows.filter((r) => !this.matches(r));
      result = rows.filter((r) => this.matches(r));
      this.store.tables[this.table] = keep;
      this.cascade(result);
    } else {
      result = rows.filter((r) => this.matches(r));
    }

    if (this.orderColumn) {
      const column = this.orderColumn;
      result = [...result].sort((a, b) => {
        const x = a[column] as string | number;
        const y = b[column] as string | number;
        if (x === y) return 0;
        return (x > y ? 1 : -1) * (this.ascending ? 1 : -1);
      });
    }

    if (this.singleMode === "one") {
      if (result.length !== 1) {
        return { data: null, error: new Error("expected exactly one row") };
      }
      return { data: result[0], error: null };
    }
    if (this.singleMode === "maybe") return { data: result[0] ?? null, error: null };

    return { data: result, error: null };
  }

  /** Mirrors the `on delete cascade` foreign keys in supabase/schema.sql. */
  private cascade(removed: Row[]) {
    if (this.table === "participants") {
      const ids = new Set(removed.map((r) => r.id));
      for (const t of ["trait_responses", "profile_cards", "text_embeddings"]) {
        this.store.tables[t] = this.store.tables[t].filter(
          (r) => !ids.has(r.participant_id as string),
        );
      }
      this.store.tables.rankings = this.store.tables.rankings.filter(
        (r) => !ids.has(r.ranker_id as string) && !ids.has(r.ranked_id as string),
      );
      this.store.tables.blocked_pairs = this.store.tables.blocked_pairs.filter(
        (r) => !ids.has(r.participant_a as string) && !ids.has(r.participant_b as string),
      );
    }
    if (this.table === "rounds") {
      const ids = new Set(removed.map((r) => r.id));
      this.store.tables.participants = this.store.tables.participants.filter(
        (r) => !ids.has(r.round_id as string),
      );
    }
  }

  then<TResult1 = { data: unknown; error: Error | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: Error | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export function createFakeSupabase(): FakeSupabase {
  return new FakeSupabase();
}
