import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calendarLink,
  eventForm,
  eventPath,
  localEventTime,
  syncLabel,
  syncMessage,
} from "../../src/lib/staff/events.mjs";

test("event forms always use New York wall time, across winter and summer", () => {
  assert.equal(localEventTime("2027-01-15T23:00:00Z"), "2027-01-15T18:00");
  assert.equal(localEventTime("2027-07-15T22:00:00Z"), "2027-07-15T18:00");
  assert.equal(localEventTime("2027-01-16T05:00:00Z"), "2027-01-16T00:00");
  assert.equal(eventForm().version, 0);
  assert.deepEqual(
    eventForm({
      title: "Workshop",
      location: "Room 1",
      version: 3,
      startsAt: "2027-01-15T23:00:00Z",
      endsAt: "2027-01-16T00:00:00Z",
    }),
    {
      title: "Workshop",
      location: "Room 1",
      description: "",
      start: "2027-01-15T18:00",
      end: "2027-01-15T19:00",
      version: 3,
    },
  );
});

test("sync messages distinguish saved records from calendar delivery and removal", () => {
  assert.equal(
    syncLabel({ status: "active", syncStatus: "failed" }),
    "Calendar sync failed",
  );
  assert.equal(
    syncLabel({ status: "cancelled", syncStatus: "failed" }),
    "Calendar removal failed",
  );
  assert.equal(
    syncLabel({ status: "cancelled", syncStatus: "synced" }),
    "Removed from calendar",
  );
  assert.match(
    syncMessage({ status: "cancelled", syncStatus: "pending" }),
    /publicly visible/,
  );
  assert.match(
    syncMessage({ status: "active", syncStatus: "pending" }),
    /Saved in the CRM/,
  );
});

test("calendar links and record URLs cannot inject an external destination", () => {
  assert.equal(eventPath("a/b", "sync"), "/staff/events/a%2Fb/sync");
  for (const raw of [
    "javascript:alert(1)",
    "https://calendar.google.com.evil.test/",
    "http://calendar.google.com/",
    "https://www.google.com/url?q=evil",
    "https://user@calendar.google.com/",
  ])
    assert.equal(calendarLink(raw), null);
  assert.ok(calendarLink("https://www.google.com/calendar/event?eid=test"));
});
