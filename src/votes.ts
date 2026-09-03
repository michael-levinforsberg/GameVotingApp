export type Day = "friday" | "saturday";

export type Likelihood =
  | "miracle"
  | "lessLikely"
  | "maybe"
  | "probably"
  | "certain";

export type Person = {
  name: string;
  friday: Likelihood | null;
  saturday: Likelihood | null;
  unavailable: boolean;
};

export type DayVote = {
  name: string;
  likelihood: Likelihood;
};

export type Result =
  | { type: "friday"; names: string[] }
  | { type: "saturday"; names: string[] }
  | { type: "waiting" };

export const STORAGE_KEY = "game-voting-app";

export type StoredVotes = {
  weekId: string;
  people: Person[];
};

export const LIKELIHOOD_OPTIONS = [
  "miracle",
  "lessLikely",
  "maybe",
  "probably",
  "certain",
] as const satisfies readonly Likelihood[];

export const LIKELIHOOD_LABELS: Record<Likelihood, string> = {
  miracle: "Mirakel",
  lessLikely: "Mindre troligt",
  maybe: "Kanske",
  probably: "Förmodligen",
  certain: "100%",
};

export const SLIDER_MAX = LIKELIHOOD_OPTIONS.length - 1;

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function namesMatch(a: string, b: string): boolean {
  return a.localeCompare(b, "sv", { sensitivity: "accent" }) === 0;
}

export function findPerson(people: Person[], name: string): Person | undefined {
  return people.find((person) => namesMatch(person.name, name));
}

export function sliderFromLikelihood(value: Likelihood): number {
  return LIKELIHOOD_OPTIONS.indexOf(value);
}

export function likelihoodFromSlider(value: number): Likelihood {
  const index = Math.min(SLIDER_MAX, Math.max(0, Math.round(value)));
  return LIKELIHOOD_OPTIONS[index];
}

export function fillPercentFromSlider(value: number): number {
  return (Math.min(SLIDER_MAX, Math.max(0, value)) / SLIDER_MAX) * 100;
}

export function formatDayBadge(name: string, likelihood: Likelihood): string {
  return `${name}: ${LIKELIHOOD_LABELS[likelihood]}`;
}

export function dayVotes(people: Person[], day: Day): DayVote[] {
  return people.flatMap((person) => {
    const likelihood = person[day];
    if (person.unavailable || likelihood === null) return [];
    return [{ name: person.name, likelihood }];
  });
}

export function votersFor(people: Person[], day: Day): string[] {
  return dayVotes(people, day).map((vote) => vote.name);
}

export function unavailableVoters(people: Person[]): string[] {
  return people.filter((person) => person.unavailable).map((person) => person.name);
}

export function hasDayVote(people: Person[], name: string, day: Day): boolean {
  const person = findPerson(people, name);
  return Boolean(person && !person.unavailable && person[day] !== null);
}

export function hasUnavailableVote(people: Person[], name: string): boolean {
  return findPerson(people, name)?.unavailable === true;
}

export function sliderStrength(votes: DayVote[]): number {
  return votes.reduce(
    (sum, vote) => sum + sliderFromLikelihood(vote.likelihood),
    0,
  );
}

export function tally(people: Person[]): Result {
  const fridayVotes = dayVotes(people, "friday");
  const saturdayVotes = dayVotes(people, "saturday");
  const fridayCount = fridayVotes.length;
  const saturdayCount = saturdayVotes.length;

  if (Math.max(fridayCount, saturdayCount) < 2) {
    return { type: "waiting" };
  }

  if (fridayCount > saturdayCount) {
    return { type: "friday", names: fridayVotes.map((vote) => vote.name) };
  }

  if (saturdayCount > fridayCount) {
    return { type: "saturday", names: saturdayVotes.map((vote) => vote.name) };
  }

  const fridayStrength = sliderStrength(fridayVotes);
  const saturdayStrength = sliderStrength(saturdayVotes);

  if (fridayStrength > saturdayStrength) {
    return { type: "friday", names: fridayVotes.map((vote) => vote.name) };
  }

  if (saturdayStrength > fridayStrength) {
    return { type: "saturday", names: saturdayVotes.map((vote) => vote.name) };
  }

  return { type: "waiting" };
}

export function voteForDay(
  people: Person[],
  name: string,
  day: Day,
  likelihood: Likelihood,
): Person[] {
  const existing = findPerson(people, name);

  if (!existing) {
    return [
      ...people,
      {
        name,
        friday: day === "friday" ? likelihood : null,
        saturday: day === "saturday" ? likelihood : null,
        unavailable: false,
      },
    ];
  }

  return people.map((person) =>
    person === existing
      ? {
          ...person,
          name,
          [day]: likelihood,
          unavailable: false,
        }
      : person,
  );
}

export function voteUnavailable(people: Person[], name: string): Person[] {
  const existing = findPerson(people, name);

  if (!existing) {
    return [
      ...people,
      { name, friday: null, saturday: null, unavailable: true },
    ];
  }

  return people.map((person) =>
    person === existing
      ? { ...person, name, friday: null, saturday: null, unavailable: true }
      : person,
  );
}

export function removeDayVote(people: Person[], name: string, day: Day): Person[] {
  return pruneEmpty(
    people.map((person) =>
      namesMatch(person.name, name) ? { ...person, [day]: null } : person,
    ),
  );
}

export function removeUnavailable(people: Person[], name: string): Person[] {
  return pruneEmpty(
    people.map((person) =>
      namesMatch(person.name, name) ? { ...person, unavailable: false } : person,
    ),
  );
}

export function mondayOfWeek(date: Date): Date {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = local.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  local.setDate(local.getDate() - daysSinceMonday);
  return local;
}

export function weekId(date: Date = new Date()): string {
  const monday = mondayOfWeek(date);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function votesForCurrentWeek(
  stored: unknown,
  now: Date = new Date(),
): StoredVotes {
  const currentWeek = weekId(now);

  if (Array.isArray(stored)) {
    return { weekId: currentWeek, people: parsePeople(stored) };
  }

  if (stored && typeof stored === "object" && "people" in stored) {
    const record = stored as { weekId?: unknown; people?: unknown };
    const storedWeek = typeof record.weekId === "string" ? record.weekId : "";
    const people = Array.isArray(record.people) ? parsePeople(record.people) : [];

    if (storedWeek !== currentWeek) {
      return { weekId: currentWeek, people: [] };
    }

    return { weekId: currentWeek, people };
  }

  return { weekId: currentWeek, people: [] };
}

export function loadPeople(now: Date = new Date()): Person[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as unknown) : null;
    const next = votesForCurrentWeek(stored, now);
    saveStored(next);
    return next.people;
  } catch {
    return [];
  }
}

export function savePeople(people: Person[], now: Date = new Date()): void {
  saveStored({ weekId: weekId(now), people });
}

function saveStored(state: StoredVotes): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parsePeople(entries: unknown[]): Person[] {
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? normalizeName(record.name) : "";
    if (!name) return [];

    return [
      {
        name,
        friday: toLikelihood(record.friday),
        saturday: toLikelihood(record.saturday),
        unavailable: record.unavailable === true,
      },
    ];
  });
}

function pruneEmpty(people: Person[]): Person[] {
  return people.filter(
    (person) =>
      person.unavailable || person.friday !== null || person.saturday !== null,
  );
}

function toLikelihood(value: unknown): Likelihood | null {
  if (
    value === "miracle" ||
    value === "lessLikely" ||
    value === "maybe" ||
    value === "probably" ||
    value === "certain"
  ) {
    return value;
  }

  if (value === "unlikely") return "miracle";

  if (typeof value === "number" && !Number.isNaN(value)) {
    return likelihoodFromSlider((value / 100) * SLIDER_MAX);
  }

  return null;
}
