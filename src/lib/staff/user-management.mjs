// Presentation helpers for staff member search. Go authorizes every request.

export function searchPath({ query = "", role = "", page = 1 } = {}) {
  const params = new URLSearchParams();
  const q = query.trim();
  if (q) params.set("q", q);
  if (role) params.set("role", role);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/staff/users?${search}` : "/staff/users";
}

export function rolePath(userID, role) {
  return `/staff/users/${encodeURIComponent(userID)}/roles/${encodeURIComponent(role)}`;
}

export function displayName(member) {
  const first = member.preferredName || member.firstName;
  const name = [first, member.lastName].filter(Boolean).join(" ");
  return name || "No name yet";
}

export function pageSummary({ total, page, pageSize, users }) {
  if (!total || !users.length) return "No matching members.";
  const start = (page - 1) * pageSize + 1;
  return `Showing ${start}–${start + users.length - 1} of ${total}`;
}

export function pageCount({ total, pageSize }) {
  return Math.max(1, Math.ceil(total / pageSize));
}

// Why a role toggle is locked for this row, or "" when it can be changed.
export function lockReason(role, member, actorID) {
  if (!role.editable) return "This role can't be changed from the dashboard.";
  if (role.confirm && member.id === actorID && member.roles.includes(role.name))
    return "You can't remove this role from your own account.";
  return "";
}

export function confirmMessage(role, member, grant) {
  return grant
    ? `Grant ${role.label} to ${member.email}?`
    : `Remove ${role.label} from ${member.email}?`;
}
