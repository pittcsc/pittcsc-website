import { faUsers } from "@fortawesome/free-solid-svg-icons";
import UserManagement from "./user-management/UserManagement";

// Component and Font Awesome icon for each tool in lib/staff/tools.mjs, keyed
// by slug.
export const toolViews = {
  "user-management": { Component: UserManagement, icon: faUsers },
};
