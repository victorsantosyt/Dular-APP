import React from "react";

type Column<T> = { key: string; label: string; render?: (row: T) => React.ReactNode };

export function AdminTable<T extends Record<string, any>>({
  columns,
  rows,
}: {
  columns: Column<T>[];
  rows: T[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className="px-2 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-t border-slate-200/70">
              {columns.map((c) => (
                <td key={c.key} className="px-2 py-2 text-sm text-slate-800">
                  {c.render ? c.render(r) : String(r[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
