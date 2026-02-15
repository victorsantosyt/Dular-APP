export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#cfe9e2] via-[#e6f3ef] to-[#f7faf9]">
      <div className="absolute inset-0 opacity-[0.10] pointer-events-none mix-blend-overlay" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">{children}</div>
    </div>
  );
}
