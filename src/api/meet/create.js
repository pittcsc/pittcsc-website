import { withHandler, readBody } from "../../lib/meet/http.js";
import { makeCode, normalizeCreate } from "../../lib/meet/model.js";
import { getMeeting, putMeeting } from "../../lib/meet/store.js";

export default withHandler("POST", async (req, res) => {
  const meeting = normalizeCreate(readBody(req));

  // Codes are short enough to be readable aloud, so check before claiming one.
  let code = makeCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!(await getMeeting(code))) break;
    code = makeCode(attempt >= 3 ? 9 : 7);
  }

  meeting.code = code;
  await putMeeting(code, meeting);

  res.status(201).json({ code, meeting });
});
