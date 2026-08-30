export default function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      {...props}
      className="h-[44px] w-full rounded-2xl bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
