import { dashboardLinks } from "./auth/navigation.mjs";
import { hasStaffRole } from "./auth/roles.mjs";
import { staffToolPath, staffTools } from "./staff/tools.mjs";

export const MEMBER_QUERY_MIN_LENGTH = 2;
export const MEMBER_RESULT_LIMIT = 5;

export function isApplePlatform(nav) {
  const platform =
    nav?.userAgentData?.platform || nav?.platform || nav?.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

// Shift/Alt combinations are left alone so other shortcuts built on K keep
// working. Comparing `key` rather than `code` follows the user's keyboard
// layout, so Dvorak users press the key labelled K.
export function isPaletteShortcut(event, apple) {
  if (event.key?.toLowerCase() !== "k") return false;
  if (event.shiftKey || event.altKey) return false;
  return apple
    ? Boolean(event.metaKey) && !event.ctrlKey
    : Boolean(event.ctrlKey) && !event.metaKey;
}

// Presentation only, like the header links it reuses: Go authorizes every
// page's API requests.
export function pageCommands(identity) {
  const links = dashboardLinks(identity, true);
  if (links.length === 0) return [];
  const pages = [
    ...links.map(({ to, label }) => ({ label, to })),
    { label: "My account", to: "/dashboard/account" },
    { label: "Your submissions", to: "/dashboard/points/submissions" },
    ...(hasStaffRole(identity)
      ? staffTools.map((tool) => ({
          label: tool.title,
          to: staffToolPath(tool.slug),
          keywords: "staff",
        }))
      : []),
  ];
  return pages.map((page) => ({ ...page, id: `page:${page.to}` }));
}

export function normalizeQuery(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function filterCommands(commands, query) {
  const needle = normalizeQuery(query);
  if (!needle) return commands;
  return commands.filter((command) =>
    [command.label, command.keywords].some((text) =>
      text?.toLowerCase().includes(needle),
    ),
  );
}

export function memberSearchPath(query) {
  const term = String(query ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (term.length < MEMBER_QUERY_MIN_LENGTH) return null;
  return `/members?${new URLSearchParams({ q: term, page: "1" })}`;
}

export function memberCommands(members = []) {
  return members.slice(0, MEMBER_RESULT_LIMIT).map((member) => ({
    id: `member:${member.id}`,
    label: member.name,
    detail: [
      (member.majors || []).join(", "),
      member.graduationYear ? `Class of ${member.graduationYear}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    to: `/dashboard/members/${member.id}`,
  }));
}

export function wrapIndex(index, length) {
  if (length === 0) return -1;
  return ((index % length) + length) % length;
}
