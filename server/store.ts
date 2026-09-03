import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  removeDayVote,
  removeUnavailable,
  voteForDay,
  voteUnavailable,
  votesForCurrentWeek,
  weekId,
  type Day,
  type Likelihood,
  type StoredVotes,
} from "../src/votes.ts";

const filePath = join(process.cwd(), "data", "votes.json");

let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => T): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function readRaw(): unknown {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeState(state: StoredVotes): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`);
}

function currentState(): StoredVotes {
  const next = votesForCurrentWeek(readRaw());
  writeState(next);
  return next;
}

export function getVotes(): Promise<StoredVotes> {
  return withLock(currentState);
}

export function applyDayVote(
  name: string,
  day: Day,
  likelihood: Likelihood,
): Promise<StoredVotes> {
  return withLock(() => {
    const current = currentState();
    const next = {
      weekId: weekId(),
      people: voteForDay(current.people, name, day, likelihood),
    };
    writeState(next);
    return next;
  });
}

export function applyUnavailableVote(name: string): Promise<StoredVotes> {
  return withLock(() => {
    const current = currentState();
    const next = {
      weekId: weekId(),
      people: voteUnavailable(current.people, name),
    };
    writeState(next);
    return next;
  });
}

export function applyRemoveDayVote(name: string, day: Day): Promise<StoredVotes> {
  return withLock(() => {
    const current = currentState();
    const next = {
      weekId: weekId(),
      people: removeDayVote(current.people, name, day),
    };
    writeState(next);
    return next;
  });
}

export function applyRemoveUnavailable(name: string): Promise<StoredVotes> {
  return withLock(() => {
    const current = currentState();
    const next = {
      weekId: weekId(),
      people: removeUnavailable(current.people, name),
    };
    writeState(next);
    return next;
  });
}
