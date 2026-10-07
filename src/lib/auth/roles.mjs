// Presentation only. Go independently authorizes every staff API request.
export function hasStaffRole(identity) {
  return Array.isArray(identity?.roles) && identity.roles.includes("staff");
}
