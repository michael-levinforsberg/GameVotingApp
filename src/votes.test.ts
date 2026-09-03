import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayVotes,
  formatDayBadge,
  hasDayVote,
  hasUnavailableVote,
  likelihoodFromSlider,
  removeDayVote,
  removeUnavailable,
  tally,
  unavailableVoters,
  voteForDay,
  voteUnavailable,
  votersFor,
  votesForCurrentWeek,
  weekId,
} from "./votes.ts";

test("stores a vote and lists the name on that day", () => {
  const people = voteForDay([], "Alex", "friday", "certain");
  assert.deepEqual(votersFor(people, "friday"), ["Alex"]);
  assert.deepEqual(votersFor(people, "saturday"), []);
});

test("updates an existing vote instead of duplicating the name", () => {
  const first = voteForDay([], "Alex", "friday", "miracle");
  const people = voteForDay(first, "alex", "friday", "certain");
  assert.equal(people.length, 1);
  assert.equal(people[0]?.friday, "certain");
  assert.equal(people[0]?.name, "alex");
});

test("lets the same person vote for both days", () => {
  const friday = voteForDay([], "Mia", "friday", "maybe");
  const people = voteForDay(friday, "Mia", "saturday", "miracle");
  assert.deepEqual(votersFor(people, "friday"), ["Mia"]);
  assert.deepEqual(votersFor(people, "saturday"), ["Mia"]);
});

test("unavailable vote removes day badges", () => {
  const voted = voteForDay([], "Kim", "saturday", "certain");
  const people = voteUnavailable(voted, "Kim");
  assert.equal(people[0]?.unavailable, true);
  assert.deepEqual(votersFor(people, "saturday"), []);
  assert.deepEqual(unavailableVoters(people), ["Kim"]);
});

test("results show the day with more votes", () => {
  let people = voteForDay([], "A", "friday", "maybe");
  people = voteForDay(people, "B", "friday", "maybe");
  people = voteForDay(people, "C", "saturday", "maybe");

  assert.deepEqual(tally(people), {
    type: "friday",
    names: ["A", "B"],
  });
});

test("results wait until a day has at least two votes", () => {
  assert.equal(tally([]).type, "waiting");

  const oneVote = voteForDay([], "A", "friday", "certain");
  assert.equal(tally(oneVote).type, "waiting");

  let tiedOnce = voteForDay([], "A", "friday", "certain");
  tiedOnce = voteForDay(tiedOnce, "B", "saturday", "certain");
  assert.equal(tally(tiedOnce).type, "waiting");
});

test("a tied vote count is broken by slider strength toward 100%", () => {
  let people = voteForDay([], "A", "friday", "certain");
  people = voteForDay(people, "B", "friday", "maybe");
  people = voteForDay(people, "C", "saturday", "maybe");
  people = voteForDay(people, "D", "saturday", "miracle");

  assert.deepEqual(tally(people), {
    type: "friday",
    names: ["A", "B"],
  });
});

test("results wait when vote count and slider strength are both tied", () => {
  let people = voteForDay([], "A", "friday", "certain");
  people = voteForDay(people, "B", "friday", "miracle");
  people = voteForDay(people, "C", "saturday", "maybe");
  people = voteForDay(people, "D", "saturday", "maybe");

  assert.equal(tally(people).type, "waiting");
});

test("slider snaps to the five labeled options", () => {
  assert.equal(likelihoodFromSlider(0), "miracle");
  assert.equal(likelihoodFromSlider(1), "lessLikely");
  assert.equal(likelihoodFromSlider(2), "maybe");
  assert.equal(likelihoodFromSlider(3), "probably");
  assert.equal(likelihoodFromSlider(4), "certain");
});

test("day badges include the chosen slider option", () => {
  const people = voteForDay([], "Alex", "friday", "maybe");
  assert.deepEqual(dayVotes(people, "friday"), [
    { name: "Alex", likelihood: "maybe" },
  ]);
  assert.equal(formatDayBadge("Alex", "maybe"), "Alex: Kanske");
  assert.equal(formatDayBadge("Alex", "probably"), "Alex: Förmodligen");
  assert.equal(formatDayBadge("Alex", "certain"), "Alex: 100%");
});

test("removes a day vote without affecting the other day", () => {
  let people = voteForDay([], "Mia", "friday", "certain");
  people = voteForDay(people, "Mia", "saturday", "maybe");
  people = removeDayVote(people, "Mia", "friday");

  assert.equal(hasDayVote(people, "Mia", "friday"), false);
  assert.equal(hasDayVote(people, "Mia", "saturday"), true);
  assert.deepEqual(votersFor(people, "friday"), []);
});

test("removing the last vote drops the person", () => {
  const voted = voteForDay([], "Alex", "friday", "maybe");
  const people = removeDayVote(voted, "Alex", "friday");
  assert.deepEqual(people, []);
});

test("removes an unavailable vote", () => {
  const voted = voteUnavailable([], "Kim");
  const people = removeUnavailable(voted, "Kim");
  assert.equal(hasUnavailableVote(people, "Kim"), false);
  assert.deepEqual(people, []);
});

test("week ids start on Monday", () => {
  assert.equal(weekId(new Date(2026, 8, 7)), "2026-09-07");
  assert.equal(weekId(new Date(2026, 8, 9)), "2026-09-07");
  assert.equal(weekId(new Date(2026, 8, 6)), "2026-08-31");
});

test("keeps votes during the same week", () => {
  const stored = {
    weekId: "2026-09-07",
    people: [{ name: "Alex", friday: "certain", saturday: null, unavailable: false }],
  };

  const next = votesForCurrentWeek(stored, new Date(2026, 8, 10));
  assert.equal(next.weekId, "2026-09-07");
  assert.equal(next.people[0]?.name, "Alex");
});

test("clears votes when a new week starts on Monday", () => {
  const stored = {
    weekId: "2026-08-31",
    people: [{ name: "Alex", friday: "certain", saturday: null, unavailable: false }],
  };

  const next = votesForCurrentWeek(stored, new Date(2026, 8, 7));
  assert.equal(next.weekId, "2026-09-07");
  assert.deepEqual(next.people, []);
});
