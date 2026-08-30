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
  const conteudo = (c: Column<T>, r: T) => (c.render ? c.render(r) : String(r[c.key] ?? ""));

  return (
    <>
      {/*
        Mobile: a tabela vira uma lista de cartões. Com 6 colunas em 414px a
        rolagem horizontal cortava o conteúdo no meio da palavra (e-mails
        truncados sem aviso), então o formato de tabela simplesmente não serve
        nessa largura.
      */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r, idx) => (
          <li key={idx} className="rounded-lg border border-border bg-surface-secondary p-3.5">
            <dl className="flex flex-col gap-2">
              {columns.map((c) => {
                const valor = conteudo(c, r);
                if (valor === "" || valor === null || valor === undefined) return null;

                // Coluna sem rótulo (ex.: botões de ação) ocupa a linha inteira.
                if (!c.label) {
                  return (
                    <dd key={c.key} className="m-0 mt-1">
                      {valor}
                    </dd>
                  );
                }

                return (
                  <div key={c.key} className="flex flex-col gap-0.5">
                    <dt className="text-eyebrow font-bold uppercase text-fg-subtle">{c.label}</dt>
                    <dd className="m-0 break-words text-sm tabular-nums text-fg">{valor}</dd>
                  </div>
                );
              })}
            </dl>
          </li>
        ))}
      </ul>

      {/* Desktop: tabela de verdade. */}
      <div className="-mx-5 hidden overflow-x-auto md:block">
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
                    {conteudo(c, r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
