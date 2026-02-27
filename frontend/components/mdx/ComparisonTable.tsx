interface ComparisonTableProps {
  headers: string[];
  rows: string[][];
}

export function ComparisonTable({ headers, rows }: ComparisonTableProps) {
  return (
    <div className="border border-border-light overflow-x-auto my-6">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="bg-surface">
            {headers.map((h) => (
              <th
                key={h}
                className="text-left px-4 py-3 font-bold text-black"
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
              className={`border-t border-border-light ${i % 2 === 1 ? "bg-surface/40" : ""}`}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 ${j === 0 ? "font-medium text-black" : "text-text-secondary"}`}
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
