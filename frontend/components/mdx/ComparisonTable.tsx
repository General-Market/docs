interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
}

export function ComparisonTable({ headers, rows }: ComparisonTableProps) {
  return (
    <div className="border border-border-light overflow-x-auto my-8">
      <table className="w-full text-[14px]">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left bg-black text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-5 py-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-border-light ${i % 2 === 1 ? "bg-surface/50" : "bg-white"}`}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-5 py-3.5 ${j === 0 ? "font-medium text-black" : "text-text-secondary"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
