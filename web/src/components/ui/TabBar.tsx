import { Ellipsis, House, ListChecks, UserRound, Wallet } from "lucide-react";

type TabIcon = "home" | "wallet" | "more" | "orders" | "profile";

export type TabItem = {
  key: string;
  label: string;
  icon: TabIcon;
};

type TabBarProps = {
  active: string;
  tabs: TabItem[];
  onPress: (key: string) => void;
};

function iconByName(name: TabIcon, active: boolean) {
  const className = active ? "text-dular-green" : "text-dular-sub";

  switch (name) {
    case "wallet":
      return <Wallet size={20} className={className} />;
    case "more":
      return <Ellipsis size={20} className={className} />;
    case "orders":
      return <ListChecks size={20} className={className} />;
    case "profile":
      return <UserRound size={20} className={className} />;
    case "home":
    default:
      return <House size={20} className={className} />;
  }
}

export function TabBar({ active, tabs, onPress }: TabBarProps) {
  return (
    <nav className="fixed bottom-[14px] left-1/2 z-20 flex h-[58px] w-[calc(100%-24px)] max-w-[408px] -translate-x-1/2 items-center justify-around rounded-22 border border-white/70 bg-white/90 px-2 py-2 shadow-tabbar backdrop-blur-md">
      {tabs.map((tab) => {
        const isActive = tab.key === active;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onPress(tab.key)}
            className={[
              "flex min-w-[88px] flex-col items-center justify-center gap-0.5 rounded-16 px-3 py-1.5 transition",
              isActive ? "bg-dular-green-light" : "bg-transparent",
              "hover:-translate-y-0.5 active:opacity-75",
            ]
              .join(" ")
              .trim()}
          >
            {iconByName(tab.icon, isActive)}
            <span className={`text-[9.5px] font-bold ${isActive ? "text-dular-green" : "text-dular-sub"}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
