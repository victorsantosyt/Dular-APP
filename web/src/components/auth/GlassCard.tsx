export default function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[420px] rounded-[28px] border border-glass-border bg-glass-surface-strong p-6 shadow-[0_18px_60px_rgba(22,33,29,0.10)] ring-1 ring-border backdrop-blur-md">
      {children}
    </div>
  );
}
