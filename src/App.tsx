import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  fetchPeople,
  submitDayVote,
  submitRemoveDayVote,
  submitRemoveUnavailable,
  submitUnavailableVote,
} from "./api";
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
  normalizeName,
  sliderFromLikelihood,
  SLIDER_MAX,
  tally,
  unavailableVoters,
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
  const [people, setPeople] = useState<Person[]>([]);
  const [syncError, setSyncError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const mutatingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (mutatingRef.current) return;

      try {
        const next = await fetchPeople();
        if (!cancelled) {
          setPeople(next);
          setSyncError("");
        }
      } catch {
        if (!cancelled) {
          setSyncError("Kunde inte hämta röster från servern.");
        }
      }
    }

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

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

  async function handleDayVote(day: Day) {
    const voter = requireName();
    if (!voter) return;

    const likelihood = likelihoodFromSlider(
      day === "friday" ? fridayValue : saturdayValue,
    );

    mutatingRef.current = true;
    try {
      setPeople(await submitDayVote(voter, day, likelihood));
      setSyncError("");
    } catch {
      setSyncError("Kunde inte spara rösten.");
    } finally {
      mutatingRef.current = false;
    }
  }

  async function handleRemoveDayVote(day: Day) {
    const voter = requireName();
    if (!voter) return;

    mutatingRef.current = true;
    try {
      setPeople(await submitRemoveDayVote(voter, day));
      setSyncError("");
    } catch {
      setSyncError("Kunde inte ta bort rösten.");
    } finally {
      mutatingRef.current = false;
    }
  }

  async function handleUnavailableVote() {
    const voter = requireName();
    if (!voter) return;

    mutatingRef.current = true;
    try {
      setPeople(await submitUnavailableVote(voter));
      setSyncError("");
    } catch {
      setSyncError("Kunde inte spara rösten.");
    } finally {
      mutatingRef.current = false;
    }
  }

  async function handleRemoveUnavailable() {
    const voter = requireName();
    if (!voter) return;

    mutatingRef.current = true;
    try {
      setPeople(await submitRemoveUnavailable(voter));
      setSyncError("");
    } catch {
      setSyncError("Kunde inte ta bort rösten.");
    } finally {
      mutatingRef.current = false;
    }
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
        {syncError ? <p className="sync-error">{syncError}</p> : null}
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
