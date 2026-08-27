/** Thin shell shared by the /meet API routes: method guard + error mapping. */

export function withHandler(methods, fn) {
  const allowed = Array.isArray(methods) ? methods : [methods];

  return async function handler(req, res) {
    if (req.method === "OPTIONS") {
      res.setHeader("Allow", [...allowed, "OPTIONS"].join(", "));
      res.status(204).send("");
      return;
    }
    if (!allowed.includes(req.method)) {
      res.setHeader("Allow", allowed.join(", "));
      res.status(405).json({ error: `Use ${allowed.join(" or ")}.` });
      return;
    }
    try {
      await fn(req, res);
    } catch (err) {
      const status = err && err.statusCode ? err.statusCode : 500;
      if (status >= 500) console.error("[meet]", err);
      res.status(status).json({
        error: status >= 500 ? "Something went wrong on our end." : err.message,
        ...(err && err.payload ? err.payload : null),
      });
    }
  };
}

export function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

export function notFound(message) {
  const err = new Error(message);
  err.statusCode = 404;
  return err;
}

export function conflict(message, payload) {
  const err = new Error(message);
  err.statusCode = 409;
  err.payload = payload;
  return err;
}

/** Meeting codes are the only user-supplied key that reaches the store. */
export function readCode(value) {
  const code = String(value == null ? "" : value).trim().toLowerCase();
  if (!/^[a-z0-9]{4,16}$/.test(code)) throw badRequest("That link doesn't look right.");
  return code;
}

/** Gatsby parses JSON bodies, but be forgiving about strings and empties. */
export function readBody(req) {
  const body = req.body;
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (e) {
      throw badRequest("Malformed request body.");
    }
  }
  return body;
}
