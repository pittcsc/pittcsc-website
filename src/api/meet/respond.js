import {
  withHandler,
  badRequest,
  conflict,
  notFound,
  readBody,
  readCode,
} from "../../lib/meet/http.js";
import { LIMITS, makeId, nameKey, normalizeRespond } from "../../lib/meet/model.js";
import { mutateMeeting } from "../../lib/meet/store.js";

/**
 * Save (or clear) one person's availability.
 *
 * `pending: true` means "I've told you my name, I haven't answered yet" — sent the
 * instant someone types their name, before they've touched the grid. That one flag is
 * what makes "not yet answered" a real, observed state in the roster rather than
 * something the organizer has to configure a headcount to approximate. Once a person
 * actually answers the flag never comes back: submitted is a ratchet.
 *
 * Identity without accounts: the browser holds an opaque participant id in
 * localStorage and sends it back. That covers the same-device case completely, which
 * is nearly all of them. When someone shows up on a second device we fall back to
 * matching on name and *ask* rather than guessing — a 409 carrying the existing entry,
 * which the client turns into "Continue as Alex" / "I'm a different Alex". Guessing
 * wrong in either direction silently corrupts someone's answer, so we don't guess.
 */
export default withHandler("POST", async (req, res) => {
  const body = readBody(req);
  const code = readCode(body.code);

  let outcome = null;

  const meeting = await mutateMeeting(code, (current) => {
    const { name, slots, source } = normalizeRespond(current, body);
    const participants = current.participants || [];
    const now = Date.now();

    const byId = body.participantId
      ? participants.find((p) => p.id === body.participantId)
      : null;

    if (byId) {
      byId.name = name;
      byId.slots = slots;
      byId.source = source;
      byId.updatedAt = now;
      if (!body.pending) byId.submittedAt = byId.submittedAt || now;
      outcome = { participantId: byId.id, submitted: Boolean(byId.submittedAt) };
      return current;
    }

    const sameName = participants.find((p) => nameKey(p.name) === nameKey(name));
    if (sameName && !body.forceNew) {
      throw conflict("Someone already answered under that name.", {
        existing: {
          id: sameName.id,
          name: sameName.name,
          updatedAt: sameName.updatedAt || sameName.submittedAt,
        },
      });
    }

    if (participants.length >= LIMITS.participants) {
      throw badRequest("This meeting has hit its participant limit.");
    }

    // Two real people can share a name; disambiguate so the roster stays readable.
    let displayName = name;
    if (sameName) {
      let suffix = 2;
      while (participants.some((p) => nameKey(p.name) === nameKey(`${name} (${suffix})`))) {
        suffix += 1;
      }
      displayName = `${name} (${suffix})`;
    }

    const created = {
      id: makeId(),
      name: displayName,
      slots,
      source,
      submittedAt: body.pending ? 0 : now,
      updatedAt: now,
    };
    participants.push(created);
    current.participants = participants;
    outcome = { participantId: created.id, submitted: Boolean(created.submittedAt) };
    return current;
  });

  if (!meeting) throw notFound("We couldn't find that meeting.");

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ meeting, ...outcome });
});
