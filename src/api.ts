import {
  type Day,
  type Likelihood,
  type Person,
  type StoredVotes,
} from "./votes";

async function readVotes(response: Response): Promise<Person[]> {
  if (!response.ok) {
    throw new Error("vote-request-failed");
  }

  const data = (await response.json()) as StoredVotes;
  return Array.isArray(data.people) ? data.people : [];
}

export async function fetchPeople(): Promise<Person[]> {
  return readVotes(await fetch("/api/votes"));
}

export async function submitDayVote(
  name: string,
  day: Day,
  likelihood: Likelihood,
): Promise<Person[]> {
  return readVotes(
    await fetch("/api/votes/day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, day, likelihood }),
    }),
  );
}

export async function submitRemoveDayVote(
  name: string,
  day: Day,
): Promise<Person[]> {
  return readVotes(
    await fetch("/api/votes/day", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, day }),
    }),
  );
}

export async function submitUnavailableVote(name: string): Promise<Person[]> {
  return readVotes(
    await fetch("/api/votes/unavailable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
}

export async function submitRemoveUnavailable(name: string): Promise<Person[]> {
  return readVotes(
    await fetch("/api/votes/unavailable", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  );
}
