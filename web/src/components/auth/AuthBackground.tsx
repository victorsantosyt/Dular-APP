export default function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-surface-secondary">
      {/* Manchas do teal da marca — mesma paleta do painel. */}
      <div className="absolute inset-0 opacity-80 [background:radial-gradient(circle_at_18%_15%,rgba(58,158,142,0.18),transparent_45%),radial-gradient(circle_at_85%_30%,rgba(58,158,142,0.12),transparent_40%),radial-gradient(circle_at_55%_85%,rgba(27,122,74,0.10),transparent_40%)]" />
      <div className="relative flex min-h-screen items-center justify-center p-6">{children}</div>
    </div>
  );
}
