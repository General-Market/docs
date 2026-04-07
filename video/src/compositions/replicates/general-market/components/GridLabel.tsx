import React from "react";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { THEME } from "../theme";

const { fontFamily: inter } = loadInter();

type Props = {
  text: string;
  accent?: boolean;
  size?: number;
};

export const GridLabel: React.FC<Props> = ({
  text,
  accent = false,
  size = 24,
}) => (
  <div
    style={{
      fontFamily: inter,
      fontSize: size,
      fontWeight: 600,
      color: accent ? THEME.green : THEME.textMuted,
      letterSpacing: 3,
      textTransform: "uppercase",
    }}
  >
    {text}
  </div>
);
