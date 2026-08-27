import test from "node:test";
import assert from "node:assert/strict";

import { buildGroup, rankWindows, pickBest, topBlockers, nearMiss, partitionAt } from "../../src/lib/meet/score.js";
import { H, freeSpans, meeting, person, withParticipants } from "./helpers.mjs";

// Expected results below are worked out by hand from the fixtures, not read off the UI.

test("an unanswered slot never counts as available", () => {
  const m = meeting();
  // Submitted, but selected nothing. That is "no times work", not "every time works".
  const g = buildGroup(withParticipants(m, [person("a", "Ann", "")]));
  assert.equal(g.total, 1);
  assert.equal(rankWindows(g)[0].count, 0);
});

test("someone who joined but hasn't answered is pending, not counted", () => {
  const m = meeting();
  const g = buildGroup(
    withParticipants(m, [
      person("a", "Ann", freeSpans(m, [[0, H(16), H(22)]])),
      person("b", "Bo", "", { submittedAt: 0 }),
    ])
  );
  assert.equal(g.total, 1, "only the answered person is counted");
  assert.equal(g.pending, 1);
  assert.deepEqual(g.waiting.map((p) => p.name), ["Bo"]);
});

test("a window needs every slot in it, not just one", () => {
  const m = meeting({ durationMin: 60 }); // 60min = 2 consecutive slots
  // Free 4:00-4:30 only: enough for a 30-min meeting, not for an hour.
  const g = buildGroup(withParticipants(m, [person("a", "Ann", freeSpans(m, [[0, H(16), H(16, 30)]]))]));
  const first = rankWindows(g).find((w) => w.start === 0);
  assert.equal(first.count, 0, "half a window is not a window");
});

test("if-needed counts toward reach but not toward the headline number", () => {
  const m = meeting();
  const g = buildGroup(
    withParticipants(m, [
      person("a", "Ann", freeSpans(m, [[0, H(18), H(19)]])),
      person("b", "Bo", freeSpans(m, [], [[0, H(18), H(19)]])),
    ])
  );
  const w = rankWindows(g).find((x) => x.startMinute === H(18) && x.dateIndex === 0);
  assert.equal(w.count, 1, "only Ann is a firm yes");
  assert.equal(w.reach, 2, "Bo could make it work");
  assert.deepEqual(w.maybe.map((p) => p.name), ["Bo"]);
});

test("counts and blocker lists agree with hand-computed truth", () => {
  const m = meeting();
  //           Wed 6-8      Thu 6-8      Fri 6-8
  // Ann        yes          yes          no
  // Bo         yes          no           yes
  // Cy         yes          yes          yes
  const g = buildGroup(
    withParticipants(m, [
      person("a", "Ann", freeSpans(m, [[0, H(18), H(20)], [1, H(18), H(20)]])),
      person("b", "Bo", freeSpans(m, [[0, H(18), H(20)], [2, H(18), H(20)]])),
      person("c", "Cy", freeSpans(m, [[0, H(18), H(20)], [1, H(18), H(20)], [2, H(18), H(20)]])),
    ])
  );
  const at = (dateIndex, minute) =>
    rankWindows(g).find((w) => w.dateIndex === dateIndex && w.startMinute === minute);

  assert.equal(at(0, H(18)).count, 3, "Wed 6pm works for all three");
  assert.equal(at(1, H(18)).count, 2);
  assert.deepEqual(at(1, H(18)).no.map((p) => p.name), ["Bo"]);
  assert.equal(at(2, H(18)).count, 2);
  assert.deepEqual(at(2, H(18)).no.map((p) => p.name), ["Ann"]);
});

test("partitionAt is the single source of truth used by both grid and ranking", () => {
  const m = meeting();
  const g = buildGroup(
    withParticipants(m, [
      person("a", "Ann", freeSpans(m, [[0, H(16), H(17)]])),
      person("b", "Bo", freeSpans(m, [], [[0, H(16), H(17)]])),
      person("c", "Cy", ""),
    ])
  );
  const p = partitionAt(g, 0, 1);
  assert.deepEqual(p.yes.map((x) => x.name), ["Ann"]);
  assert.deepEqual(p.maybe.map((x) => x.name), ["Bo"]);
  assert.deepEqual(p.no.map((x) => x.name), ["Cy"]);
  // The per-slot tally the heatmap prints must agree with the partition it explains.
  assert.equal(g.perSlot.free[0], p.yes.length);
  assert.equal(g.perSlot.maybe[0], p.maybe.length);
});

test("no overlap at all still ranks, with zero available", () => {
  const m = meeting();
  const g = buildGroup(
    withParticipants(m, [
      person("a", "Ann", freeSpans(m, [[0, H(16), H(18)]])),
      person("b", "Bo", freeSpans(m, [[3, H(20), H(22)]])),
    ])
  );
  assert.equal(rankWindows(g)[0].count, 1, "best case is one person, never zero-length");
  assert.ok(!rankWindows(g).some((w) => w.count === 2), "there is no shared window");
});

test("everyone available ranks a full house first", () => {
  const m = meeting();
  const all = freeSpans(m, [[0, H(16), H(22)], [1, H(16), H(22)]]);
  const g = buildGroup(
    withParticipants(m, ["a", "b", "c", "d"].map((id, i) => person(id, `P${i}`, all)))
  );
  assert.equal(rankWindows(g)[0].count, 4);
});

test("shortlist offers distinct days rather than the same evening four times", () => {
  const m = meeting();
  const wideOpen = freeSpans(m, m.dates.map((_, d) => [d, H(16), H(22)]));
  const g = buildGroup(withParticipants(m, [person("a", "Ann", wideOpen)]));
  const best = pickBest(rankWindows(g), 3);
  assert.equal(best.length, 3);
  assert.equal(new Set(best.map((w) => w.dateIndex)).size, 3, "one option per day");
});

test("ties break toward the earlier day, then the earlier time", () => {
  const m = meeting();
  const both = freeSpans(m, [[0, H(18), H(20)], [1, H(18), H(20)]]);
  const g = buildGroup(withParticipants(m, [person("a", "Ann", both)]));
  const top = rankWindows(g)[0];
  assert.equal(top.dateIndex, 0);
  assert.equal(top.startMinute, H(18));
});

test("topBlockers names someone only when they block most of the strong options", () => {
  const m = meeting();
  const open = m.dates.map((_, d) => [d, H(16), H(22)]);
  const g = buildGroup(
    withParticipants(m, [
      person("a", "Ann", freeSpans(m, open)),
      person("b", "Bo", freeSpans(m, open)),
      person("c", "Cy", freeSpans(m, [[3, H(20), H(21)]])), // free for exactly one hour
    ])
  );
  assert.deepEqual(topBlockers(rankWindows(g)).map((b) => b.person.name), ["Cy"]);
});

test("nearMiss stays quiet when a unanimous time already exists", () => {
  const m = meeting();
  const open = freeSpans(m, [[0, H(18), H(20)]]);
  const g = buildGroup(
    withParticipants(m, ["a", "b", "c"].map((id, i) => person(id, `P${i}`, open)))
  );
  assert.equal(nearMiss(g, rankWindows(g)), null);
});

test("muting a participant is a what-if that changes only the calculation", () => {
  const m = meeting();
  const open = m.dates.map((_, d) => [d, H(16), H(22)]);
  const participants = [
    person("a", "Ann", freeSpans(m, open)),
    person("b", "Bo", freeSpans(m, open)),
    person("c", "Cy", ""),
  ];
  const withCy = buildGroup(withParticipants(m, participants));
  const withoutCy = buildGroup(withParticipants(m, participants), new Set(["c"]));
  assert.equal(rankWindows(withCy)[0].count, 2);
  assert.equal(withoutCy.total, 2);
  assert.equal(rankWindows(withoutCy)[0].count, 2);
  assert.equal(withCy.answered.length, 3, "muted people stay in the roster");
});

test("scales to 30 participants without changing the answer shape", () => {
  const m = meeting();
  const open = m.dates.map((_, d) => [d, H(16), H(22)]);
  const many = Array.from({ length: 30 }, (_, i) =>
    person(`p${i}`, `P${i}`, freeSpans(m, i === 7 ? [[0, H(18), H(19)]] : open))
  );
  const g = buildGroup(withParticipants(m, many));
  const ranked = rankWindows(g);
  assert.equal(g.total, 30);
  assert.equal(ranked[0].count, 30, "the hour P7 can make works for all 30");
  assert.equal(ranked[0].startMinute, H(18));
});
