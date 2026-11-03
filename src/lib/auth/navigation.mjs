import { hasStaffRole } from "./roles.mjs";

// Links in the signed-in header. Accounts still finishing their profile get
// none, because the dashboard sends them back to My Account. This only decides
// what to show: Go authorizes every staff request.
export function dashboardLinks(identity, dashboard) {
  if (!dashboard || !identity?.complete) return [];
  return [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/dashboard/points", label: "Points", partiallyActive: true },
    { to: "/dashboard/members", label: "Members", partiallyActive: true },
    { to: "/dashboard/foundry", label: "Foundry", partiallyActive: true },
    ...(hasStaffRole(identity)
      ? [{ to: "/dashboard/staff", label: "Staff", partiallyActive: true }]
      : []),
  ];
}
