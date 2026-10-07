// Staff tool registry, in dashboard order. To add a tool: add an entry here,
// map its slug to a component in components/staff/tools.js, and protect its API
// routes with the Go staff guard. This list only controls presentation.
export const STAFF_BASE = "/dashboard/staff";

export const staffTools = [
  {
    slug: "user-management",
    title: "User Management",
    description:
      "Search members by name or email and grant or revoke their roles.",
    action: "Open user management",
  },
];

export function staffToolPath(slug) {
  return `${STAFF_BASE}/${slug}`;
}

// Resolve a dashboard pathname to the staff home, a registered tool, or not found.
export function staffRoute(pathname, tools = staffTools) {
  const path = pathname.replace(/\/+$/, "");
  if (path === STAFF_BASE) return { view: "home" };
  if (!path.startsWith(`${STAFF_BASE}/`)) return { view: "notFound" };
  const [slug, ...rest] = path.slice(STAFF_BASE.length + 1).split("/");
  const tool = tools.find((candidate) => candidate.slug === slug);
  return tool && rest.length === 0
    ? { view: "tool", tool }
    : { view: "notFound" };
}
