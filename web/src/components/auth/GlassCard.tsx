export default function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[420px] rounded-[28px] border border-white/30 bg-white/35 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl ring-1 ring-slate-900/5">
      {children}
    </div>
  );
}
