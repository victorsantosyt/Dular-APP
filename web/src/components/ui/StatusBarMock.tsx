import { BatteryFull, Signal, Wifi } from "lucide-react";

type StatusBarMockProps = {
  time?: string;
  dark?: boolean;
};

export function StatusBarMock({ time = "9:41", dark = false }: StatusBarMockProps) {
  const tone = dark ? "text-dular-ink" : "text-white";

  return (
    <div className="flex items-center justify-between px-5 pb-1 pt-3">
      <span className={`text-[12px] font-bold ${tone}`}>{time}</span>
      <div className={`flex items-center gap-1.5 ${tone}`}>
        <Signal size={13} strokeWidth={2} />
        <Wifi size={13} strokeWidth={2} />
        <BatteryFull size={15} strokeWidth={2} />
      </div>
    </div>
  );
}
