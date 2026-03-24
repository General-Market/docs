import React from "react";
import type { ShotDef } from "./types";
import { useSlotContext } from "./SlotContext";
import { ProjectDataCard } from "./components/ProjectDataCard";

interface Props {
  shot: ShotDef;
  prevProjectTicker?: string;
}

export const DataCardSlot: React.FC<Props> = ({ shot, prevProjectTicker }) => {
  if (!shot.projectDataCard) return null;

  const { assetDir } = useSlotContext();
  const card = shot.projectDataCard;
  const isContinuation = prevProjectTicker === card.ticker;

  return (
    <ProjectDataCard
      name={card.name}
      ticker={card.ticker}
      logo={card.logo}
      color={card.color}
      category={card.category}
      pricePath={card.pricePath}
      pricePrefix={card.pricePrefix}
      priceDecimals={card.priceDecimals}
      assetDir={assetDir}
      badgeLogo={card.badgeLogo}
      isContinuation={isContinuation}
    />
  );
};
