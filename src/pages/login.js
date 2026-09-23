import React, { useEffect, useRef, useState } from "react";
import { navigate } from "gatsby";
import AuthFrame from "../components/auth/AuthFrame";
import SessionStatus from "../components/auth/SessionStatus";
import { useAuth } from "../components/auth/AuthProvider";
import { RESEND_SECONDS, safeReturnTo } from "../lib/auth/policy.mjs";

export default function Login({ location }) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState(null);
  const [code, setCode] = useState("");
  const [action, setAction] = useState(null);
  const busy = action !== null;
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const inputRef = useRef(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const cooldowns = useRef(new Map());
  const destination = safeReturnTo(
    new URLSearchParams(location.search).get("returnTo"),
  );
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (auth.status === "authenticated")
      void navigate(destination, { replace: true });
  }, [auth.status, destination]);
  useEffect(() => {
    setNow(Date.now());
    if (!retryAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  useEffect(() => {
    inputRef.current?.focus();
  }, [sentEmail]);

  async function sendCode(event) {
    event?.preventDefault();
    if (inFlight.current) return;
    const target = sentEmail || email;
    const until = cooldowns.current.get(target.trim().toLowerCase()) || 0;
    if (until > Date.now()) {
      setRetryAt(until);
      setNow(Date.now());
      setError("Please wait before requesting another code.");
      return;
    }
    inFlight.current = true;
    setAction("send");
    setError(null);
    setNotice("");
    const result = await auth.requestCode(target);
    inFlight.current = false;
    if (!mounted.current) return;
    setAction(null);
    if (!result.error || result.rateLimited) {
      const next = Date.now() + RESEND_SECONDS * 1000;
      cooldowns.current.set(target.trim().toLowerCase(), next);
      setRetryAt(next);
      setNow(Date.now());
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    setSentEmail(result.email);
    setCode("");
    setNotice("Code sent. Check your inbox and spam folder.");
    inputRef.current?.focus();
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setAction("verify");
    setError(null);
    setNotice("");
    const result = await auth.verifyCode(sentEmail, code.trim());
    inFlight.current = false;
    if (!mounted.current) return;
    setAction(null);
    if (result.error) setError(result.error);
  }

  return (
    <AuthFrame>
      <h1>Sign in / Create account</h1>
      {auth.status !== "signedOut" ? (
        auth.status === "authenticated" ? (
          <p role="status">Taking you back…</p>
        ) : (
          <SessionStatus auth={auth} />
        )
      ) : (
        <>
          <p>
            Use your Pitt email to sign in or create your CSC account. No
            password needed.
          </p>
          {auth.error && <p role="status">{auth.error}</p>}
          <form onSubmit={sentEmail ? verifyCode : sendCode} aria-busy={busy}>
            {sentEmail ? (
              <>
                <p>
                  Enter the code sent to <strong>{sentEmail}</strong>. It
                  expires in 15 minutes.
                </p>
                <label htmlFor="login-code">Six-digit code</label>
                <input
                  ref={inputRef}
                  id="login-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  disabled={busy}
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={Boolean(error)}
                />
              </>
            ) : (
              <>
                <label htmlFor="login-email">Pitt email</label>
                <input
                  ref={inputRef}
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@pitt.edu"
                  required
                  value={email}
                  disabled={busy}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setRetryAt(
                      cooldowns.current.get(
                        event.target.value.trim().toLowerCase(),
                      ) || 0,
                    );
                    setNow(Date.now());
                    setError(null);
                  }}
                  aria-describedby={error ? "login-error" : undefined}
                  aria-invalid={Boolean(error)}
                />
              </>
            )}
            {error && (
              <p id="login-error" role="alert">
                {error}
              </p>
            )}
            <p role="status">{notice}</p>
            <button
              type="submit"
              disabled={busy || (!sentEmail && remaining > 0)}
            >
              {busy
                ? action === "send"
                  ? "Sending code…"
                  : "Checking code…"
                : sentEmail
                  ? "Verify code"
                  : remaining > 0
                    ? `Try again in ${remaining}s`
                    : "Send code"}
            </button>
            {sentEmail && (
              <div className="csc-auth-actions">
                <button
                  className="csc-auth-secondary"
                  type="button"
                  disabled={busy || remaining > 0}
                  onClick={() => void sendCode()}
                >
                  {remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}
                </button>
                <button
                  className="csc-auth-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSentEmail(null);
                    setCode("");
                    setError(null);
                    setNotice("");
                  }}
                >
                  Change email
                </button>
              </div>
            )}
          </form>
        </>
      )}
    </AuthFrame>
  );
}

export const Head = () => (
  <>
    <title>Sign in | Pitt CSC</title>
    <meta name="robots" content="noindex" />
  </>
);
