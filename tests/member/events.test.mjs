import assert from "node:assert/strict";
import test from "node:test";
import {
  eventExcerpt,
  formatEventRange,
  isInProgress,
} from "../../src/lib/member/events.mjs";

test("member event times stay in New York across daylight saving time", () => {
  const range = formatEventRange({
    startsAt: "2026-07-10T22:00:00Z",
    endsAt: "2026-07-10T23:00:00Z",
  });
  assert.match(range, /Jul 10, 2026, 6:00 PM EDT/);
  assert.match(range, /6:00 PM EDT – 7:00 PM EDT/);
  assert.match(
    formatEventRange({
      startsAt: "2027-01-10T22:00:00Z",
      endsAt: "2027-01-10T23:00:00Z",
    }),
    /5:00 PM EST.*6:00 PM EST/,
  );
  assert.match(
    formatEventRange({
      startsAt: "2027-01-11T04:00:00Z",
      endsAt: "2027-01-11T06:00:00Z",
    }),
    /Jan 10, 2027.*Jan 11, 2027/,
  );
});

test("an event is in progress from its start until, but not including, its end", () => {
  const event = {
    startsAt: "2026-11-02T18:00:00Z",
    endsAt: "2026-11-02T19:00:00Z",
  };
  assert.equal(isInProgress(event, Date.parse("2026-11-02T17:59:59Z")), false);
  assert.equal(isInProgress(event, Date.parse(event.startsAt)), true);
  assert.equal(isInProgress(event, Date.parse(event.endsAt)), false);
});

test("descriptions are compact and whitespace is normalized", () => {
  assert.equal(
    eventExcerpt("  Bring a laptop\n and a friend.  "),
    "Bring a laptop and a friend.",
  );
  assert.equal(
    eventExcerpt("A long description with more details", 20),
    "A long description…",
  );
});
