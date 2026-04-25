type EarningsBoxProps = {
  value: string;
  label?: string;
};

export function EarningsBox({ value, label = "Ganhos do mês" }: EarningsBoxProps) {
  return (
    <aside className="rounded-13 bg-dular-card px-3 py-2 text-right shadow-card">
      <p className="text-[14px] font-extrabold text-dular-green-dark">{value}</p>
      <p className="text-[9px] font-semibold text-dular-sub">{label}</p>
    </aside>
  );
}
