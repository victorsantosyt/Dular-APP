import type { ComponentProps, ReactNode } from "react";

type InputFieldProps = Omit<ComponentProps<"input">, "size"> & {
  icon: ReactNode;
  rightSlot?: ReactNode;
  containerClassName?: string;
};

export function InputField({ icon, rightSlot, containerClassName = "", className = "", ...props }: InputFieldProps) {
  return (
    <div
      className={[
        "group flex h-[52px] w-full items-center gap-2 rounded-13 border border-transparent bg-dular-card px-4 shadow-card transition",
        "focus-within:border-dular-green focus-within:shadow-[0_0_0_1px_var(--dular-green)]",
        containerClassName,
      ]
        .join(" ")
        .trim()}
    >
      <span className="text-dular-sub">{icon}</span>
      <input
        {...props}
        className={[
          "h-full w-full border-none bg-transparent text-[14px] font-medium text-dular-ink outline-none placeholder:text-dular-sub",
          className,
        ]
          .join(" ")
          .trim()}
      />
      {rightSlot ? <div className="shrink-0 text-dular-sub">{rightSlot}</div> : null}
    </div>
  );
}
