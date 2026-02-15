export default function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="h-[44px] w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-sm font-medium text-white shadow-sm ring-1 ring-white/30 hover:brightness-95 active:brightness-90 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
