import React from "react";

export type CellStyle = {
  bg: string;
  opacity?: number;
  border?: string;
  glow?: string;
};

export type GridProps = {
  rows: number;
  cols: number;
  width: number;
  height: number;
  gap?: number;
  renderCell: (row: number, col: number) => CellStyle;
  style?: React.CSSProperties;
};

export const Grid: React.FC<GridProps> = ({
  rows,
  cols,
  width,
  height,
  gap = 8,
  renderCell,
  style,
}) => {
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = renderCell(r, c);
      cells.push(
        <div
          key={`${r}-${c}`}
          style={{
            background: cell.bg,
            opacity: cell.opacity ?? 1,
            border: cell.border ?? "none",
            borderRadius: 2,
            boxShadow: cell.glow ?? "none",
          }}
        />,
      );
    }
  }

  return (
    <div
      style={{
        width,
        height,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap,
        ...style,
      }}
    >
      {cells}
    </div>
  );
};
