import type { ProfileCard } from "@/lib/profile-cards";
import { QUESTIONS_BY_ID, type ScaleQuestion } from "@/lib/questions";

const WANT_FIELDS = [
  { key: "closeness", question: "q23" },
  { key: "communication", question: "q24" },
  { key: "cadence", question: "q25" },
] as const;

function WantMeter({ questionId, value }: { questionId: string; value: number }) {
  const q = QUESTIONS_BY_ID[questionId] as ScaleQuestion;
  return (
    <div>
      <div className="flex justify-between gap-3 text-[10px] leading-tight text-faint">
        <span>{q.low}</span>
        <span className="text-right">{q.high}</span>
      </div>
      <div className="mt-1 flex gap-0.5">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-sm ${n === value ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function ProfileCardView({
  card,
  selected = false,
  showRole = false,
  action,
}: {
  card: ProfileCard;
  selected?: boolean;
  showRole?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <article
      className={`card flex h-full flex-col p-4 transition ${
        selected ? "border-accent ring-1 ring-accent" : ""
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Profile #{card.display_number}</h3>
          <p className="text-xs text-muted">
            {card.background.year}
            {card.background.focus ? ` · ${card.background.focus}` : ""}
            {showRole ? ` · ${card.role}` : ""}
          </p>
        </div>
        {action}
      </header>

      {card.standout_traits.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {card.standout_traits.map((trait) => (
            <li key={trait.source} className="pill" title={`${trait.source} = ${trait.value}`}>
              {trait.label}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="label">Excited about</dt>
          <dd className="mt-0.5 leading-snug">{card.excited_about}</dd>
        </div>
        <div>
          <dt className="label">Ideal relationship</dt>
          <dd className="mt-0.5 leading-snug">{card.ideal_relationship}</dd>
        </div>
        <div>
          <dt className="label">Hoping for</dt>
          <dd className="mt-0.5 leading-snug text-muted">
            {card.values.join(" · ")}
            {card.group_role ? ` — usually ${card.group_role.toLowerCase()}` : ""}
          </dd>
        </div>
      </dl>

      <div className="mt-auto space-y-2 pt-4">
        {WANT_FIELDS.map(({ key, question }) => (
          <WantMeter key={key} questionId={question} value={card.wants[key]} />
        ))}
      </div>
    </article>
  );
}
