import type { ButtonHTMLAttributes } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ className = "", children, ...props }: PrimaryButtonProps) {
  return (
    <button
      {...props}
      className={[
        "inline-flex h-[54px] w-full items-center justify-center rounded-22 bg-gradient-to-r from-dular-green to-dular-teal",
        "text-[16px] font-extrabold text-white shadow-[0_8px_24px_rgba(45,140,150,0.38)] transition",
        "hover:-translate-y-0.5 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        className,
      ]
        .join(" ")
        .trim()}
    >
      {children}
    </button>
  );
}
