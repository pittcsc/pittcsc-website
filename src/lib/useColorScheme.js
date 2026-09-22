import { useEffect, useState } from "react";

const QUERY = "(prefers-color-scheme: dark)";

/**
 * True when the viewer's system is set to dark.
 *
 * Nearly everything on this site themes itself in CSS and never needs to ask. This
 * exists for the one thing that can't: the hero's Lottie, whose colours live inside
 * its JSON and so have to be chosen in JavaScript rather than inherited.
 *
 * Starts `false` so the server-rendered markup and the first client render agree —
 * the real value lands in an effect, which for a decorative animation is soon enough.
 */
export function usePrefersDark() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(QUERY);
    const sync = (e) => setDark(e.matches);
    sync(mq);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return dark;
}
