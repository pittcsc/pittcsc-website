import React, { useEffect, useRef, useState } from "react";
import { Link, navigate } from "gatsby";
import { motion, useReducedMotion } from "framer-motion";
import SessionStatus from "../components/auth/SessionStatus";
import { useAuth } from "../components/auth/AuthProvider";
import { RESEND_SECONDS, safeReturnTo } from "../lib/auth/policy.mjs";
import logo from "../images/hero_image.png";
import "../styles/login.scss";

const CODE_LENGTH = 6;

function IconCheck(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#213f9d"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function IconAlert(props) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v6M12 17h.01" />
    </svg>
  );
}

// Same draw-on animation the index hero uses for its swooshes: pathLength 0 -> 1.
const drawLine = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (i = 0) => ({
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.8, delay: i * 0.15 },
  }),
};

function BrandPanel() {
  const reduceMotion = useReducedMotion();
  const motionProps = reduceMotion
    ? {}
    : { variants: drawLine, initial: "hidden", animate: "show" };

  return (
    <aside className="csc-login-brand">
      <Link className="csc-login-wordmark" to="/">
        <span className="csc-login-mark">
          <img src={logo} alt="" width={64} height={49} />
        </span>
        Pitt CSC
      </Link>

      <h2 className="csc-login-pitch">
        One account for{" "}
        <span className="csc-login-underline">
          everything
          <svg
            viewBox="0 0 200 16"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <motion.path
              d="M3 11 C 60 3, 140 2, 197 9"
              custom={2}
              {...motionProps}
            />
          </svg>
        </span>{" "}
        CSC.
      </h2>

      <svg
        className="csc-login-swoosh"
        viewBox="0 0 720 220"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <motion.path
          d="M-20 60 C 160 0, 360 40, 740 200"
          custom={0}
          {...motionProps}
        />
        <motion.path
          d="M-20 104 C 160 44, 340 90, 700 230"
          custom={1}
          {...motionProps}
        />
      </svg>

      {/* Balances space-between so the headline sits off the bottom edge. */}
      <div className="csc-login-spacer" aria-hidden="true" />
    </aside>
  );
}

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
    setNotice(
      `Code sent to ${result.email}. Check your inbox and spam folder.`,
    );
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

  const onCodeStep = Boolean(sentEmail);

  function renderBody() {
    if (auth.status !== "signedOut") {
      return auth.status === "authenticated" ? (
        <>
          <h1>You’re signed in</h1>
          <p role="status">Taking you back…</p>
        </>
      ) : (
        <>
          <h1>Sign in or join</h1>
          <SessionStatus auth={auth} />
        </>
      );
    }

    return (
      <>
        <div className="csc-login-steps">
          <div>
            <span className="done" />
            <span className={onCodeStep ? "done" : undefined} />
          </div>
          <p>Step {onCodeStep ? 2 : 1} of 2</p>
        </div>

        {auth.error && (
          <div className="csc-login-alert error" role="status">
            <IconAlert />
            <span>{auth.error}</span>
          </div>
        )}

        <form onSubmit={onCodeStep ? verifyCode : sendCode} aria-busy={busy}>
          <div className="csc-login-fieldset">
            {onCodeStep ? (
              <>
                <div className="csc-login-heading">
                  <h1>Check your inbox</h1>
                  <p>
                    We sent a {CODE_LENGTH}-digit code to{" "}
                    <strong>{sentEmail}</strong>. It expires in 15 minutes.
                  </p>
                </div>
                <div className="csc-login-field">
                  <label htmlFor="login-code">Verification code</label>
                  <div className="csc-login-code" data-invalid={Boolean(error)}>
                    <input
                      ref={inputRef}
                      id="login-code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={CODE_LENGTH}
                      required
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      disabled={busy}
                      aria-describedby={error ? "login-error" : undefined}
                      aria-invalid={Boolean(error)}
                    />
                    <div className="csc-login-code-boxes" aria-hidden="true">
                      {Array.from({ length: CODE_LENGTH }, (_, index) => (
                        <span
                          key={index}
                          className={
                            code[index]
                              ? "filled"
                              : index === code.length
                                ? "next"
                                : undefined
                          }
                        >
                          {code[index] || ""}
                        </span>
                      ))}
                    </div>
                  </div>
                  {error && (
                    <p
                      id="login-error"
                      className="csc-login-inline-error"
                      role="alert"
                    >
                      <IconAlert />
                      {error}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="csc-login-heading">
                  <h1>Sign in or join</h1>
                  <p>
                    Enter your Pitt email and we’ll send you a {CODE_LENGTH}
                    -digit code. New here? We’ll set up your account in the same
                    step. No password needed.
                  </p>
                </div>
                <div className="csc-login-field">
                  <label htmlFor="login-email">Pitt email</label>
                  <input
                    ref={inputRef}
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="abc123@pitt.edu"
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
                  {error && (
                    <p
                      id="login-error"
                      className="csc-login-inline-error"
                      role="alert"
                    >
                      <IconAlert />
                      {error}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Persistent live region so a later notice is announced. */}
            <div
              className={notice ? "csc-login-alert notice" : "csc-login-quiet"}
              role="status"
            >
              {notice && (
                <>
                  <IconCheck width="18" height="18" stroke="#f5b82e" />
                  <span>{notice}</span>
                </>
              )}
            </div>

            <button
              className="csc-login-submit"
              type="submit"
              disabled={busy || (!onCodeStep && remaining > 0)}
            >
              {busy
                ? action === "send"
                  ? "Sending code…"
                  : "Checking code…"
                : onCodeStep
                  ? "Verify & continue"
                  : remaining > 0
                    ? `Try again in ${remaining}s`
                    : "Send code"}
            </button>

            {onCodeStep && (
              <div className="csc-login-links">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setSentEmail(null);
                    setCode("");
                    setError(null);
                    setNotice("");
                  }}
                >
                  Use a different email
                </button>
                <button
                  type="button"
                  disabled={busy || remaining > 0}
                  onClick={() => void sendCode()}
                >
                  {remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}
                </button>
              </div>
            )}
          </div>
        </form>
      </>
    );
  }

  return (
    <div className="csc-login">
      <BrandPanel />
      <main className="csc-login-panel">
        <div className="csc-login-cardwrap">
          <div className="csc-login-card">
            {renderBody()}
            <Link className="csc-login-back" to="/">
              Back to website
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export const Head = () => (
  <>
    <title>Sign in | Pitt CSC</title>
    <meta name="robots" content="noindex" />
  </>
);
