import React from "react";
import { ChibiExplainer } from "../../lib/templates/ChibiExplainer";
import { config } from "./config";

export const ExampleShort: React.FC = () => {
  return <ChibiExplainer config={config} />;
};
