type Props = React.InputHTMLAttributes<HTMLInputElement> & { label: string };

export default function PillInput({ label, ...props }: Props) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-slate-600">{label}</label>
      <input
        {...props}
        className="w-full rounded-2xl border border-white/30 bg-white/65 px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-emerald-500/25"
      />
    </div>
  );
}
