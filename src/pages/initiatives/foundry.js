import React from "react";
import InitiativeTemplate from "../../components/InitiativeTemplate";
import { foundryContent } from "../../data/foundryContent";

const FoundryPage = () => {
  return <InitiativeTemplate data={foundryContent} />;
};

export default FoundryPage;
