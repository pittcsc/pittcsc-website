import { withHandler } from "../../lib/meet/http.js";
import { storeStatus } from "../../lib/meet/store.js";

/**
 * "Is this deployment actually keeping meetings?"
 *
 * Storage is the one part of /meet that fails silently — the app works perfectly right
 * up until a meeting lands on a different serverless instance and disappears. This
 * endpoint makes the answer checkable in one request, before anyone relies on a link.
 *
 * It reports the adapter and whether it can be reached; it never returns a credential,
 * so it's safe to hit in production.
 */
export default withHandler("GET", async (req, res) => {
  const status = await storeStatus();

  res.setHeader("Cache-Control", "no-store");
  res.status(status.reachable ? 200 : 503).json({
    ok: status.reachable && status.durable,
    ...status,
    advice: status.durable
      ? undefined
      : "Meetings are on a local disk. On a serverless host they will not survive " +
        "between instances — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
  });
});
