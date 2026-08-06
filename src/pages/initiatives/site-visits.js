import React from "react";
import InitiativeTemplate from "../../components/InitiativeTemplate";
import { siteVisitsContent } from "../../data/siteVisitsContent";

const SiteVisitsPage = () => {
  return <InitiativeTemplate data={siteVisitsContent} />;
};

export default SiteVisitsPage;
