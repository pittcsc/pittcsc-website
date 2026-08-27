import { withHandler, notFound, readCode } from "../../lib/meet/http.js";
import { getMeeting } from "../../lib/meet/store.js";

export default withHandler("GET", async (req, res) => {
  const code = readCode(req.query && req.query.code);
  const meeting = await getMeeting(code);
  if (!meeting) throw notFound("We couldn't find that meeting.");

  // Availability changes constantly; never let a CDN answer on our behalf.
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ meeting });
});
