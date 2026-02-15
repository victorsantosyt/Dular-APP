export function AdminGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-12">{children}</div>;
}
