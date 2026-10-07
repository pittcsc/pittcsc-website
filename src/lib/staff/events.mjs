export const EVENT_TIMEZONE = "America/New_York";

export const eventFilters = [
  ["upcoming", "Upcoming"],
  ["past", "Past"],
  ["cancelled", "Cancelled"],
  ["all", "All events"],
];

export function eventPath(id, action = "") {
  return `/staff/events/${encodeURIComponent(id)}${action ? `/${action}` : ""}`;
}

export function localEventTime(value) {
  if (!value) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EVENT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function eventForm(record) {
  return {
    title: record?.title || "",
    location: record?.location || "",
    description: record?.description || "",
    start: localEventTime(record?.startsAt),
    end: localEventTime(record?.endsAt),
    version: record?.version || 0,
  };
}

export function formatEventTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function syncLabel(record) {
  if (record.syncStatus === "synced")
    return record.status === "cancelled"
      ? "Removed from calendar"
      : "Synced to calendar";
  if (record.syncStatus === "disabled") return "Calendar not connected";
  if (record.syncStatus === "failed")
    return record.status === "cancelled"
      ? "Calendar removal failed"
      : "Calendar sync failed";
  return record.status === "cancelled"
    ? "Calendar removal pending"
    : "Calendar sync pending";
}

export function syncMessage(record) {
  if (record.syncStatus === "synced") return "";
  if (record.syncError) return record.syncError;
  return record.status === "cancelled"
    ? "This event is cancelled, but its calendar removal is unconfirmed. It may still be publicly visible. Retry removal."
    : "Saved in the CRM. Calendar sync is unconfirmed; use Sync to Calendar to try again.";
}

export function calendarLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === "calendar.google.com" ||
        (url.hostname === "www.google.com" &&
          url.pathname.startsWith("/calendar/")))
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export const auditLabels = {
  created: "Created event",
  updated: "Updated event",
  cancelled: "Cancelled event",
  sync_succeeded: "Calendar sync completed",
  sync_failed: "Calendar sync failed",
  sync_disabled: "Calendar not connected",
};
