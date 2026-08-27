import crypto from "crypto";
import { withHandler, notFound, readCode } from "../../lib/meet/http.js";
import { getMeeting } from "../../lib/meet/store.js";

export default withHandler("GET", async (req, res) => {
  const code = readCode(req.query && req.query.code);
  const meeting = await getMeeting(code);
  if (!meeting) throw notFound("We couldn't find that meeting.");

  // Availability changes constantly; never let a CDN answer on our behalf.
  res.setHeader("Cache-Control", "no-store");

  // Clients poll this every 15s while a meeting is open, and the answer is usually
  // identical. An ETag turns a repeat poll into a 304 with no body — which matters
  // most for the case that generates the most traffic: a big roster on a phone.
  const body = JSON.stringify({ meeting });
  const etag = `W/"${crypto.createHash("sha1").update(body).digest("base64url")}"`;
  res.setHeader("ETag", etag);

  if (req.headers["if-none-match"] === etag) {
    res.status(304).send("");
    return;
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).send(body);
});
