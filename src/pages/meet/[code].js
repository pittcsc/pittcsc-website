import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "gatsby";
import { motion } from "framer-motion";

import Layout from "../../layouts/layout";
import Seo from "../../components/seo";
import ShareBar from "../../components/meet/ShareBar";
import AvailabilityGrid from "../../components/meet/AvailabilityGrid";
import GroupGrid from "../../components/meet/GroupGrid";
import BestTimes from "../../components/meet/BestTimes";
import Roster from "../../components/meet/Roster";
import ImportPanel from "../../components/meet/ImportPanel";

import {
  clearIdentity,
  fetchMeeting,
  loadIdentity,
  rememberMeeting,
  rememberedName,
  saveAvailability,
  saveIdentity,
} from "../../lib/meet/client";
import {
  UNAVAILABLE,
  decodeSlots,
  emptySlots,
  encodeSlots,
  enumerateSlots,
  slotCount,
} from "../../lib/meet/model";
import {
  buildGroup,
  buildViewGrid,
  nearMiss,
  pickBest,
  rankWindows,
  topBlockers,
} from "../../lib/meet/score";
import { trackManualEdits } from "../../lib/meet/calendar";
import { describeWindow, nameList, summarizeDates } from "../../lib/meet/format";
import { durationLabel, localTz, rangeLabel, tzCity } from "../../lib/meet/time";

const SAVE_DEBOUNCE_MS = 650;
const POLL_MS = 15000;

const CALLOUT =
  "px-4 py-3 text-sm bg-secondary-200 border border-secondary-100 rounded-2xl";

/** What a shared link says before React knows which meeting it is. */
const SHARE_TITLE = "Add your availability | Computer Science Club @ Pitt";

const PRIMARY_BTN =
  "px-5 py-2.5 text-white font-bold bg-primary rounded-full focus:outline-none hover:shadow-lg shadow-md transition";

export default function MeetRoom({ params, location }) {
  const code = String((params && params.code) || "").toLowerCase();
  const isNew = /(?:\?|&)new=1(?:&|$)/.test((location && location.search) || "");

  const [meeting, setMeeting] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [mySlots, setMySlots] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [tab, setTab] = useState("you");
  const [muted, setMuted] = useState(() => new Set());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [hoverWindow, setHoverWindow] = useState(null);
  const [source, setSource] = useState("manual");
  const [useMeetingTz, setUseMeetingTz] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [peeking, setPeeking] = useState(false);

  const saveTimer = useRef(null);
  const pendingSlots = useRef(null);
  const manualEdits = useRef(new Set());
  const lastPayload = useRef(null);

  const browserTz = useMemo(() => localTz(), []);
  const viewerTz = useMeetingTz && meeting ? meeting.tz : browserTz;

  /* ------------------------------- loading ------------------------------- */

  const hydrate = useCallback(
    (next, { keepMine } = {}) => {
      // Every derived value keys off `meeting` identity, so handing React a fresh
      // object re-runs slot enumeration, the timezone projection and the whole ranking
      // pipeline — then re-renders every cell. The 15s poll usually returns exactly
      // what we already have, so compare before adopting it.
      const fingerprint = JSON.stringify(next);
      if (fingerprint === lastPayload.current) return;
      lastPayload.current = fingerprint;

      setMeeting(next);
      const stored = loadIdentity(code);
      const me = stored && (next.participants || []).find((p) => p.id === stored.id);

      if (me) {
        setIdentity({ id: me.id, name: me.name });
        setSubmitted(Boolean(me.submittedAt));
        if (!keepMine) setMySlots(decodeSlots(me.slots, slotCount(next)));
      } else if (stored) {
        // The entry was removed (or the store was reset) — start clean rather than
        // pretending to be an id that no longer exists.
        clearIdentity(code);
        setIdentity(null);
      }
    },
    [code]
  );

  useEffect(() => {
    let cancelled = false;
    fetchMeeting(code)
      .then(({ meeting: found }) => {
        if (cancelled || !found) return;
        hydrate(found);
        rememberMeeting({ code, name: found.name });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [code, hydrate]);

  /* A poll like this is usually filled in by several people over a few minutes, often
     in the same room, so keep the group view live without a refresh. */
  useEffect(() => {
    if (!meeting) return undefined;
    const id = window.setInterval(() => {
      if (document.hidden || saveTimer.current) return;
      fetchMeeting(code)
        .then(({ meeting: found }) => found && hydrate(found, { keepMine: true }))
        .catch(() => {});
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [code, meeting, hydrate]);

  /* -------------------------------- derived -------------------------------- */

  const slots = useMemo(
    () => (meeting ? enumerateSlots(meeting) : []),
    [meeting]
  );
  const view = useMemo(
    () => (slots.length ? buildViewGrid(slots, viewerTz) : null),
    [slots, viewerTz]
  );
  const group = useMemo(
    () => (meeting ? buildGroup(meeting, muted) : null),
    [meeting, muted]
  );
  const ranked = useMemo(() => (group ? rankWindows(group) : []), [group]);
  const best = useMemo(() => pickBest(ranked, 3), [ranked]);
  const blockers = useMemo(() => (ranked.length ? topBlockers(ranked) : []), [ranked]);
  const miss = useMemo(() => (group ? nearMiss(group, ranked) : null), [group, ranked]);

  // An answer with nothing selected would silently read as "none of these work", so
  // the submit path stays closed until there's something to say.
  const hasSelection = useMemo(
    () => Boolean(mySlots && mySlots.some((state) => state !== UNAVAILABLE)),
    [mySlots]
  );

  const bestSlots = useMemo(() => spanOf(best[0]), [best]);
  const focusSlots = useMemo(() => spanOf(hoverWindow), [hoverWindow]);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/meet/${code}`
      : `https://pittcsc.org/meet/${code}`;

  /* --------------------------------- saving --------------------------------- */

  const flush = useCallback(
    async (overrides) => {
      if (!identity || !pendingSlots.current) return;
      setSaveState("saving");
      try {
        const result = await saveAvailability({
          code,
          participantId: identity.id,
          name: identity.name,
          slots: encodeSlots(pendingSlots.current),
          source,
          pending: false,
          ...overrides,
        });
        pendingSlots.current = null;
        setSaveState("saved");
        setSubmitted(true);
        hydrate(result.meeting, { keepMine: true });
      } catch (err) {
        setSaveState("error");
      }
    },
    [code, hydrate, identity, source]
  );

  const scheduleSave = useCallback(
    (next) => {
      pendingSlots.current = next;
      setSaveState("saving");
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        flush();
      }, SAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  // Don't let a closing tab eat the last few strokes.
  useEffect(() => {
    const onHide = () => {
      if (!saveTimer.current) return;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      flush();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  const onGridChange = useCallback(
    (next, indices, options) => {
      setMySlots(next);
      trackManualEdits(manualEdits.current, indices, options);
      setSource("manual");
      scheduleSave(next);
    },
    [scheduleSave]
  );

  const onImport = useCallback(
    (next, importSource) => {
      setMySlots(next);
      setSource(importSource);
      pendingSlots.current = next;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      flush({ slots: encodeSlots(next), source: importSource });
    },
    [flush]
  );

  /* --------------------------------- render --------------------------------- */

  if (loadError) {
    return (
      <Shell title={SHARE_TITLE}>
        <h1 className="mb-3 text-3xl font-bold">That link didn&apos;t work</h1>
        <p className="mb-6 text-gray-500">{loadError}</p>
        <Link className={PRIMARY_BTN} to="/meet">
          Create a meeting
        </Link>
      </Shell>
    );
  }

  if (!meeting || !view || !group) {
    return (
      <Shell title={SHARE_TITLE} wide>
        <div className="meet-skeleton h-10 w-64" />
        <div className="meet-skeleton h-14 mt-5" />
        <div className="meet-skeleton h-96 mt-5" />
      </Shell>
    );
  }

  const windowMs = {
    start: slots[0].utcMs,
    end: slots[slots.length - 1].utcMs + meeting.slotMin * 60000,
    tz: viewerTz,
  };
  const headline = best[0] ? describeWindow(best[0], slots, viewerTz) : null;
  const differentTz = browserTz !== meeting.tz;

  return (
    <Shell title={`${meeting.name} | Computer Science Club @ Pitt`} wide>
      <header className="mb-5">
        <h1 className="text-3xl font-bold lg:text-4xl">{meeting.name}</h1>
        <p className="mt-1 text-gray-500 text-sm">
          {summarizeDates(meeting.dates)} · {rangeLabel(meeting.startMin, meeting.endMin)} ·{" "}
          {durationLabel(meeting.durationMin)}
        </p>
      </header>

      {isNew && (
        <div className="mb-6 p-5 border border-primary rounded-2xl">
          <p className="mb-3 font-bold">Send this to the group</p>
          <ShareBar url={shareUrl} title={meeting.name} />
        </div>
      )}

      {!identity && !peeking ? (
        <NameGate
          code={code}
          meeting={meeting}
          group={group}
          onPeek={() => {
            setPeeking(true);
            setTab("group");
          }}
          onReady={(next, isSubmitted) => {
            setIdentity(next);
            setSubmitted(isSubmitted);
            const found = (meeting.participants || []).find((p) => p.id === next.id);
            setMySlots(
              found
                ? decodeSlots(found.slots, slotCount(meeting))
                : emptySlots(slotCount(meeting))
            );
          }}
          setMeeting={setMeeting}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-2xl">
            {group.total === 0 ? (
              <span className="text-gray-500">
                <b className="text-gray-900">No answers yet.</b> Be the first.
              </span>
            ) : (
              <>
                <span className="text-gray-500">
                  <b className="text-gray-900">{group.total}</b> answered
                  {group.pending > 0 ? `, ${group.pending} still deciding` : ""}
                </span>
                {headline && (
                  <>
                    <span className="hidden text-gray-300 sm:inline" aria-hidden="true">
                      •
                    </span>
                    <span className="text-gray-500">
                      Best so far{" "}
                      <b className="text-gray-900">
                        {headline.dow} {headline.md}, {headline.range}
                      </b>{" "}
                      — {best[0].count}/{group.total}
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 my-5">
            <div
              className="inline-flex p-1 bg-gray-100 rounded-full"
              role="tablist"
              aria-label="Views"
            >
              <Tab
                selected={tab === "you"}
                onClick={() => (identity ? setTab("you") : setPeeking(false))}
              >
                {identity ? "Your availability" : "Add yours"}
              </Tab>
              <Tab selected={tab === "group"} onClick={() => setTab("group")}>
                Group
                <span
                  className={`px-2 py-0.5 ml-2 text-xs rounded-full ${
                    tab === "group" ? "bg-white bg-opacity-20" : "bg-white text-gray-500"
                  }`}
                >
                  {group.total}
                </span>
              </Tab>
            </div>

            {identity ? (
              <div className="flex items-center gap-3 text-gray-400 text-sm">
                <SaveIndicator state={saveState} onRetry={() => flush()} />
                <span>
                  as <b className="text-gray-700">{identity.name}</b>
                </span>
                <button
                  type="button"
                  className="underline hover:text-gray-700"
                  onClick={() => {
                    clearIdentity(code);
                    setIdentity(null);
                    setMySlots(null);
                    setPeeking(false);
                  }}
                >
                  not you?
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={PRIMARY_BTN}
                onClick={() => setPeeking(false)}
              >
                Add my availability
              </button>
            )}
          </div>

          {differentTz && (
            <p className="flex flex-wrap items-center gap-2 mb-4 text-gray-400 text-sm">
              <span>Shown in {tzCity(browserTz)} time.</span>
              <button
                type="button"
                className="underline hover:text-gray-700"
                onClick={() => setUseMeetingTz((v) => !v)}
              >
                {useMeetingTz
                  ? `Switch to ${tzCity(browserTz)}`
                  : `Show ${tzCity(meeting.tz)}`}
              </button>
            </p>
          )}

          {tab === "you" && identity && mySlots ? (
            <div className="space-y-6">
              <ImportPanel
                slots={slots}
                states={mySlots}
                manual={manualEdits.current}
                onImport={onImport}
                windowMs={windowMs}
              />

              <AvailabilityGrid view={view} states={mySlots} onChange={onGridChange} />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-gray-400 text-sm">
                  {hasSelection
                    ? submitted
                      ? "Saved. Change it any time."
                      : "Looks good — send it through."
                    : "Pick the times you can make. Nothing is selected yet."}
                </p>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  className={`${PRIMARY_BTN} disabled:opacity-40`}
                  disabled={!hasSelection}
                  onClick={() => {
                    if (!submitted) {
                      pendingSlots.current = mySlots;
                      flush();
                    }
                    setTab("group");
                  }}
                >
                  {submitted ? "See results" : "Done"}
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {miss && (
                <p className={CALLOUT}>
                  Everyone except <b>{miss.person.name}</b> can do{" "}
                  <b>{describeWindow(miss.window, slots, viewerTz).short}</b>.
                </p>
              )}
              {!miss && blockers.length > 0 && (
                <p className={CALLOUT}>
                  <b>{nameList(blockers.map((b) => b.person))}</b>{" "}
                  {blockers.length === 1 ? "is" : "are"} busy for most of the strongest
                  times.
                </p>
              )}

              <BestTimes
                windows={best}
                group={group}
                slots={slots}
                viewerTz={viewerTz}
                meeting={meeting}
                shareUrl={shareUrl}
                onHover={setHoverWindow}
              />

              <Roster
                group={group}
                youId={identity && identity.id}
                muted={muted}
                onToggleMute={(id) =>
                  setMuted((prev) => {
                    if (id === null) return new Set();
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
              />

              <GroupGrid
                view={view}
                group={group}
                bestSlots={bestSlots}
                focusSlots={focusSlots}
                selected={selectedSlot}
                onSelect={setSelectedSlot}
              />

              <ShareBar url={shareUrl} title={meeting.name} />
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

/* --------------------------------- pieces --------------------------------- */

/**
 * `title` is what a browser tab shows once React has the meeting. It is *not* what a
 * link unfurler sees: this is a client-only route, so Slack, iMessage and friends only
 * ever get the pre-hydration HTML. That HTML previously carried the loading state, so
 * every shared meeting link unfurled as "Loading" — on the one screen whose entire job
 * is to be shared. Hence the meet-specific defaults.
 */
function Shell({ title, wide, children }) {
  return (
    <Layout title={title}>
      <Seo
        title={title}
        description="Someone shared a meeting with you. Add the times you're free and the best slot for everyone appears automatically."
      />
      <motion.div
        className="meet overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="mt-24 mb-16 min-h-screen md:mt-10">
          <section className="container mx-auto w-full">
            <div className={`mx-auto w-11/12 ${wide ? "max-w-5xl" : "max-w-xl"}`}>
              {children}
            </div>
          </section>
        </div>
      </motion.div>
    </Layout>
  );
}

function Tab({ selected, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`inline-flex items-center px-4 py-2 text-sm font-bold rounded-full transition ${
        selected ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function SaveIndicator({ state, onRetry }) {
  const text = { idle: "", saving: "Saving…", saved: "Saved", error: "Not saved" }[state];
  if (!text) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="meet-dot" data-state={state} aria-hidden="true" />
      {text}
      {state === "error" && (
        <button type="button" className="underline hover:text-gray-700" onClick={onRetry}>
          Retry
        </button>
      )}
    </span>
  );
}

function spanOf(window) {
  const set = new Set();
  if (window) {
    for (let i = window.start; i < window.start + window.k; i += 1) set.add(i);
  }
  return set;
}

/**
 * The only thing between opening the link and answering: a name, prefilled from the one
 * you used last time. When it's already taken we ask instead of guessing — silently
 * merging two different Alexes, or splitting one Alex across two devices, are both
 * worse than one extra question.
 */
function NameGate({ code, meeting, group, onReady, onPeek, setMeeting }) {
  const [name, setName] = useState(() => rememberedName());
  const [conflict, setConflict] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const join = async (options = {}) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Add a name so the group knows who you are.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await saveAvailability({
        code,
        name: trimmed,
        slots: "",
        pending: true,
        ...options,
      });
      const next = { id: result.participantId, name: trimmed };
      saveIdentity(code, next);
      setMeeting(result.meeting);
      onReady(next, Boolean(result.submitted));
    } catch (err) {
      if (err.status === 409 && err.payload && err.payload.existing) {
        setConflict(err.payload.existing);
      } else {
        setError(err.message);
      }
      setBusy(false);
    }
  };

  if (conflict) {
    const firstName = conflict.name.split(" ")[0];
    return (
      <div className="p-6 max-w-md bg-white border border-gray-200 rounded-2xl">
        <p className="font-bold">Someone already answered as {conflict.name}</p>
        <p className="mt-1 mb-4 text-gray-500 text-sm">
          If that was you on another device, pick up where you left off.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BTN}
            disabled={busy}
            onClick={() => {
              const next = { id: conflict.id, name: conflict.name };
              saveIdentity(code, next);
              const found = (meeting.participants || []).find((p) => p.id === conflict.id);
              onReady(next, Boolean(found && found.submittedAt));
            }}
          >
            That&apos;s me
          </button>
          <button
            type="button"
            className="px-5 py-2.5 font-bold bg-white border border-gray-300 rounded-full hover:border-gray-500 transition"
            disabled={busy}
            onClick={() => {
              setConflict(null);
              join({ forceNew: true });
            }}
          >
            Different {firstName}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="p-6 max-w-md bg-white border border-gray-200 rounded-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        join();
      }}
    >
      <label className="block mb-3 font-bold" htmlFor="meet-you">
        Your name
      </label>
      {error && <p className="mb-3 text-red-700 text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <input
          id="meet-you"
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:border-primary focus:ring-primary"
          style={{ minWidth: 160 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoFocus
          autoComplete="name"
        />
        <button type="submit" className={PRIMARY_BTN} disabled={busy}>
          {busy ? "…" : "Continue"}
        </button>
      </div>
      {group.total > 0 && (
        <button
          type="button"
          className="mt-4 text-gray-400 text-sm underline hover:text-gray-700"
          onClick={onPeek}
        >
          See results without answering
        </button>
      )}
    </form>
  );
}
