import Image from "next/image";

export default function LogoDular() {
  return (
    <div className="flex items-center justify-center">
      <Image
        // usa o arquivo oficial em public/brand
        src="/brand/dular-login.png"
        alt="Dular"
        width={220}
        height={120}
        priority
        className="h-auto w-[220px] max-w-full"
      />
    </div>
  );
}
