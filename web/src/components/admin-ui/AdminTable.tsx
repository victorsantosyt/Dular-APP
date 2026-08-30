import React from "react";

// As células usam `tabular-nums`: afeta apenas os dígitos (datas, contagens,
// notas alinham entre as linhas) sem alterar a renderização do texto.
type Column<T> = { key: string; label: string; render?: (row: T) => React.ReactNode };

export function AdminTable<T extends Record<string, any>>({
  columns,
  rows,
}: {
  columns: Column<T>[];
  rows: T[];
}) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-5 pb-2.5 text-eyebrow font-bold uppercase text-fg-subtle"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr
              key={idx}
              className="border-b border-border-subtle transition-colors last:border-0 hover:bg-surface-subtle"
            >
              {columns.map((c) => (
                <td key={c.key} className="px-5 py-3 text-sm tabular-nums text-fg">
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
