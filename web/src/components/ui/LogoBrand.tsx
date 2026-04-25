import Image from "next/image";

type LogoVariant = "full" | "mark" | "small";

type LogoBrandProps = {
  variant?: LogoVariant;
  className?: string;
  priority?: boolean;
};

const variantMap: Record<LogoVariant, { src: string; alt: string; width: number; height: number; className: string }> = {
  full: {
    src: "/brand/dular-login.png",
    alt: "Dular",
    width: 220,
    height: 220,
    className: "w-[156px] h-auto",
  },
  mark: {
    src: "/brand/dular-mark.png",
    alt: "Dular mark",
    width: 84,
    height: 84,
    className: "w-[42px] h-auto",
  },
  small: {
    src: "/brand/dular-login.png",
    alt: "Dular",
    width: 160,
    height: 160,
    className: "w-[110px] h-auto",
  },
};

export function LogoBrand({ variant = "full", className = "", priority = false }: LogoBrandProps) {
  const config = variantMap[variant];

  return (
    <Image
      src={config.src}
      alt={config.alt}
      width={config.width}
      height={config.height}
      priority={priority}
      className={`${config.className} select-none ${className}`.trim()}
    />
  );
}
