import React from "react";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
}

/** Minimal accessible table with an empty state. */
export function DataTable<T>({ rows, columns, empty = "Nothing to show." }: { rows: T[]; columns: Column<T>[]; empty?: string }) {
  if (rows.length === 0) return <p className="bg-card rounded-xl border border-border p-space-lg text-center text-ink-secondary">{empty}</p>;
  return (
    <div className="overflow-x-auto bg-card rounded-xl border border-border">
      <table className="w-full text-left">
        <thead className="bg-canvas">
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" className="px-space-md py-space-sm font-label-md text-label-md text-ink-secondary">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {columns.map((c) => (
                <td key={c.header} className="px-space-md py-space-sm font-body-md text-body-md">{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
