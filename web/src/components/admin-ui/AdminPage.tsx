type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
};

export function AdminPage({ title, subtitle, right, children }: Props) {
  // Páginas cujo título já vive no Header do AdminLayout passam title="" —
  // nesse caso o cabeçalho não é renderizado (evita bloco vazio no topo).
  const hasHeader = Boolean(title || subtitle || right);

  return (
    <div>
      {hasHeader ? (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {title ? <h1 className="text-display font-bold text-fg">{title}</h1> : null}
            {subtitle ? (
              <p className="mt-1.5 text-sm leading-relaxed text-fg-subtle">{subtitle}</p>
            ) : null}
          </div>
          {right ? <div className="shrink-0">{right}</div> : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}
