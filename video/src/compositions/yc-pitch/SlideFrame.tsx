import React from "react";
import { AbsoluteFill } from "remotion";
import { COLOR, FONT, PAD, CONTENT_MAX } from "./tokens";

type Props = {
  eyebrow?: string;
  pageNumber?: number;
  pageTotal?: number;
  hideChrome?: boolean;
  brand?: string;
  align?: "start" | "center";
  children: React.ReactNode;
};

export const SlideFrame: React.FC<Props> = ({
  eyebrow,
  pageNumber,
  pageTotal,
  hideChrome,
  brand = "Company",
  align = "start",
  children,
}) => {
  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      {!hideChrome && (
        <div
          style={{
            position: "absolute",
            top: 56,
            left: PAD.x,
            fontFamily: FONT.text,
            fontSize: 17,
            fontWeight: 500,
            color: COLOR.muted,
            letterSpacing: "-0.022em",
          }}
        >
          {brand}
        </div>
      )}

      {pageNumber !== undefined && pageTotal !== undefined && (
        <div
          style={{
            position: "absolute",
            bottom: 56,
            right: PAD.x,
            fontFamily: FONT.text,
            fontSize: 15,
            color: COLOR.muted,
            letterSpacing: "0.04em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(pageNumber).padStart(2, "0")} / {String(pageTotal).padStart(2, "0")}
        </div>
      )}

      <AbsoluteFill
        style={{
          padding: `${PAD.y}px ${PAD.x}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: align === "center" ? "center" : "flex-start",
          textAlign: align === "center" ? "center" : "left",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: CONTENT_MAX,
            display: "flex",
            flexDirection: "column",
            alignItems: align === "center" ? "center" : "flex-start",
          }}
        >
          {eyebrow && (
            <div
              style={{
                fontFamily: FONT.text,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: COLOR.blue,
                marginBottom: 40,
              }}
            >
              {eyebrow}
            </div>
          )}
          {children}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

type TitleProps = {
  children: React.ReactNode;
  size?: number;
};

export const SlideTitle: React.FC<TitleProps> = ({ children, size = 96 }) => (
  <h1
    style={{
      fontFamily: FONT.display,
      fontSize: size,
      fontWeight: 600,
      color: COLOR.ink,
      lineHeight: 1.05,
      letterSpacing: "-0.025em",
      margin: 0,
      marginBottom: 40,
    }}
  >
    {children}
  </h1>
);

type SubtitleProps = {
  children: React.ReactNode;
  maxWidth?: number;
};

export const SlideSubtitle: React.FC<SubtitleProps> = ({ children, maxWidth }) => (
  <p
    style={{
      fontFamily: FONT.display,
      fontSize: 36,
      fontWeight: 400,
      color: COLOR.muted,
      lineHeight: 1.3,
      letterSpacing: "-0.018em",
      margin: 0,
      maxWidth,
    }}
  >
    {children}
  </p>
);

type PlaceholderProps = {
  children: React.ReactNode;
  height?: number;
  width?: number | string;
};

export const Placeholder: React.FC<PlaceholderProps> = ({
  children,
  height = 220,
  width = "100%",
}) => (
  <div
    style={{
      width,
      height,
      borderRadius: 24,
      border: `1px dashed ${COLOR.lineStrong}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT.text,
      fontSize: 17,
      color: COLOR.placeholder,
      letterSpacing: "-0.022em",
      marginTop: 32,
    }}
  >
    {children}
  </div>
);
