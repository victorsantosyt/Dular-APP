import { ReactNode, RefObject } from "react";

type Props = {
  icon: ReactNode;
  inputRef?: RefObject<HTMLInputElement>;
} & React.InputHTMLAttributes<HTMLInputElement>;

export default function LoginInput({ icon, inputRef, ...props }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-white/40">
      <div className="text-slate-400">{icon}</div>
      <input
        {...props}
        ref={inputRef}
        className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  );
}
