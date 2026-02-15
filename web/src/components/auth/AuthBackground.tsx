export default function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-emerald-50 via-white to-cyan-50">
      <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_18%_15%,rgba(16,185,129,0.20),transparent_45%),radial-gradient(circle_at_85%_30%,rgba(6,182,212,0.18),transparent_40%),radial-gradient(circle_at_55%_85%,rgba(34,197,94,0.14),transparent_40%)]" />
      <div className="relative flex min-h-screen items-center justify-center p-6">{children}</div>
    </div>
  );
}
