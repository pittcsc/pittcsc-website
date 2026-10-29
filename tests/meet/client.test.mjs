/**
 * fetchMeeting's conditional-request behaviour. The ETag cache is module state, so
 * these cover who is allowed to get a 304 and who must always get a body.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { fetchMeeting } from "../../src/lib/meet/client.js";

/** Records what was asked for and replies with whatever the test queues up. */
function stubFetch(replies) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, headers: options.headers || {} });
    const reply = replies.shift();
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      headers: { get: (name) => (name === "ETag" ? reply.etag || null : null) },
      json: async () => reply.body ?? null,
    };
  };
  return calls;
}

const meetingBody = { meeting: { code: "abc123", name: "Standup" } };

test("a repeat visit to a room still gets a body", async () => {
  const original = global.fetch;
  try {
    // First load caches the ETag, exactly as a poll would.
    const calls = stubFetch([
      { status: 200, etag: 'W/"v1"', body: meetingBody },
      { status: 304 },
      { status: 200, etag: 'W/"v1"', body: meetingBody },
    ]);

    const first = await fetchMeeting("abc123");
    assert.equal(first.meeting.name, "Standup");
    assert.equal(calls[0].headers["If-None-Match"], undefined);

    // A poll revalidates and is allowed to come back empty.
    const polled = await fetchMeeting("abc123");
    assert.equal(calls[1].headers["If-None-Match"], 'W/"v1"');
    assert.equal(polled.notModified, true);

    // Landing on the room again has nothing on screen to revalidate against, so it
    // must not send the ETag — a 304 here used to leave the page on its skeleton
    // forever, with no meeting and no error.
    const revisit = await fetchMeeting("abc123", { fresh: true });
    assert.equal(calls[2].headers["If-None-Match"], undefined);
    assert.equal(revisit.meeting.name, "Standup");
    assert.equal(revisit.notModified, undefined);
  } finally {
    global.fetch = original;
  }
});
