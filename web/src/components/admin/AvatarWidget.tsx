"use client";

type Props = {
  avatarUrl?: string | null;
  label?: string | null;
  size?: number;
};

export default function AvatarWidget({ avatarUrl, label, size = 36 }: Props) {
  const initial = (label?.trim()?.[0] || "U").toUpperCase();

  return (
    <div
      className="overflow-hidden rounded-full bg-white/40 ring-1 ring-white/30 shadow-sm"
      style={{ width: size, height: size }}
      title={label ?? "Perfil"}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-700">
          {initial}
        </div>
      )}
    </div>
  );
}
