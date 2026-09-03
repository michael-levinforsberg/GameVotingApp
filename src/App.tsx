import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  dayVotes,
  fillPercentFromSlider,
  findPerson,
  formatDayBadge,
  hasDayVote,
  hasUnavailableVote,
  likelihoodFromSlider,
  LIKELIHOOD_LABELS,
  LIKELIHOOD_OPTIONS,
  loadPeople,
  normalizeName,
  removeDayVote,
  removeUnavailable,
  savePeople,
  sliderFromLikelihood,
  SLIDER_MAX,
  tally,
  unavailableVoters,
  voteForDay,
  voteUnavailable,
  type Day,
  type Person,
} from "./votes";

const DAYS: {
  id: Day;
  title: string;
  subtitle: string;
}[] = [
  { id: "friday", title: "🎮 Fredag", subtitle: "Jag kan spela på fredag" },
  { id: "saturday", title: "🎮 Lördag", subtitle: "Jag kan spela på lördag" },
];

const DEFAULT_SLIDER = sliderFromLikelihood("certain");

function App() {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [fridayValue, setFridayValue] = useState(DEFAULT_SLIDER);
  const [saturdayValue, setSaturdayValue] = useState(DEFAULT_SLIDER);
  const [people, setPeople] = useState<Person[]>(() =>
    typeof localStorage === "undefined" ? [] : loadPeople(),
  );
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    savePeople(people);
  }, [people]);

  const result = useMemo(() => tally(people), [people]);
  const trimmedName = normalizeName(name);

  function requireName(): string | null {
    if (!trimmedName) {
      setNameError("Ange ett namn för att rösta.");
      nameInputRef.current?.focus();
      return null;
    }

    setNameError("");
    setName(trimmedName);
    return trimmedName;
  }

  function handleDayVote(day: Day) {
    const voter = requireName();
    if (!voter) return;

    const likelihood = likelihoodFromSlider(
      day === "friday" ? fridayValue : saturdayValue,
    );
    setPeople((current) => voteForDay(current, voter, day, likelihood));
  }

  function handleRemoveDayVote(day: Day) {
    const voter = requireName();
    if (!voter) return;

    setPeople((current) => removeDayVote(current, voter, day));
  }

  function handleUnavailableVote() {
    const voter = requireName();
    if (!voter) return;

    setPeople((current) => voteUnavailable(current, voter));
  }

  function handleRemoveUnavailable() {
    const voter = requireName();
    if (!voter) return;

    setPeople((current) => removeUnavailable(current, voter));
  }

  function sliderValue(day: Day): number {
    return day === "friday" ? fridayValue : saturdayValue;
  }

  function setSliderValue(day: Day, value: number) {
    if (day === "friday") setFridayValue(value);
    else setSaturdayValue(value);
  }

  return (
    <main className="voting-screen">
      <section className="voting-column" aria-label="Röstning">
        <label className="field">
          <span className="field-label">Namn</span>
          <input
            ref={nameInputRef}
            className={`field-input${nameError ? " is-invalid" : ""}`}
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Ange namn här"
            value={name}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "name-error" : undefined}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              if (nameError) setNameError("");

              const existing = findPerson(people, normalizeName(nextName));
              if (existing?.friday) {
                setFridayValue(sliderFromLikelihood(existing.friday));
              }
              if (existing?.saturday) {
                setSaturdayValue(sliderFromLikelihood(existing.saturday));
              }
            }}
          />
          {nameError ? (
            <p id="name-error" className="field-error">
              {nameError}
            </p>
          ) : null}
        </label>

        {DAYS.map((day) => {
          const value = sliderValue(day.id);
          const canRemove = hasDayVote(people, trimmedName, day.id);

          return (
            <article className="card" key={day.id}>
              <div className="card-section">
                <h2 className="card-title">{day.title}</h2>
                <p className="card-subtitle">{day.subtitle}</p>
              </div>

              <div className="slider-section">
                <input
                  className="slider"
                  type="range"
                  min={0}
                  max={SLIDER_MAX}
                  step={1}
                  value={value}
                  style={
                    {
                      "--pct": `${fillPercentFromSlider(value)}%`,
                    } as CSSProperties
                  }
                  aria-label={`${day.title}: hur troligt`}
                  aria-valuetext={LIKELIHOOD_LABELS[likelihoodFromSlider(value)]}
                  onChange={(event) => {
                    setSliderValue(day.id, Number(event.target.value));
                  }}
                />
                <div className="slider-labels">
                  {LIKELIHOOD_OPTIONS.map((option, index) => (
                    <button
                      key={option}
                      type="button"
                      className={`slider-label${value === index ? " is-selected" : ""}`}
                      onClick={() => setSliderValue(day.id, index)}
                    >
                      {LIKELIHOOD_LABELS[option]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="button-row">
                <button
                  className="button"
                  type="button"
                  onClick={() => handleDayVote(day.id)}
                >
                  Rösta
                </button>
                {canRemove ? (
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => handleRemoveDayVote(day.id)}
                  >
                    Ta bort
                  </button>
                ) : null}
              </div>

              <div className="badge-row" aria-label={`Röster för ${day.title}`}>
                {dayVotes(people, day.id).map((vote) => (
                  <span className="badge" key={`${day.id}-${vote.name}`}>
                    {formatDayBadge(vote.name, vote.likelihood)}
                  </span>
                ))}
              </div>
            </article>
          );
        })}

        <div className="opt-out">
          <div className="opt-out-header">
            <p>🚫 Jag kan inte spela alls i helgen</p>
            <div className="opt-out-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={handleUnavailableVote}
              >
                Rösta
              </button>
              {hasUnavailableVote(people, trimmedName) ? (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => handleRemoveUnavailable()}
                >
                  Ta bort
                </button>
              ) : null}
            </div>
          </div>
          <div className="badge-row opt-out-badges" aria-label="Kan inte spela">
            {unavailableVoters(people).map((voter) => (
              <span className="badge" key={`unavailable-${voter}`}>
                {voter}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="results" aria-live="polite" aria-label="Resultat">
        {result.type === "waiting" ? (
          <p className="results-waiting">Inväntar resultat</p>
        ) : (
          <>
            <p className="results-kicker">Vi spelar på</p>
            <p className="results-day">
              {result.type === "friday" ? "Fredag" : "Lördag"}
            </p>
            <p className="results-names">{result.names.join(", ")}</p>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
