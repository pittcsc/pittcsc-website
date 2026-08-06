import React from "react";
import InitiativeTemplate from "../../components/InitiativeTemplate";
import { launchpadContent } from "../../data/launchpadContent";

const LaunchpadPage = () => {
  return <InitiativeTemplate data={launchpadContent} />;
};

export default LaunchpadPage;
