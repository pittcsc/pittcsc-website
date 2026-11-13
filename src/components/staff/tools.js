import {
  faUsers,
  faEnvelope,
  faCalendarDays,
  faAward,
} from "@fortawesome/free-solid-svg-icons";
import EmailCampaigns from "./email/EmailCampaigns";
import UserManagement from "./user-management/UserManagement";
import Events from "./events/Events";
import PointClaims from "./points/PointClaims";

// Component and Font Awesome icon for each tool in lib/staff/tools.mjs, keyed
// by slug.
export const toolViews = {
  email: { Component: EmailCampaigns, icon: faEnvelope },
  "user-management": { Component: UserManagement, icon: faUsers },
  events: { Component: Events, icon: faCalendarDays },
  "point-claims": { Component: PointClaims, icon: faAward },
};
