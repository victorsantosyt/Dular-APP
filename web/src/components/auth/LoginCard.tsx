export default function LoginCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-full max-w-[560px] px-10 py-10"
      style={{
        borderRadius: "26px",
        background: "rgba(255,255,255,0.40)",
        border: "1px solid rgba(255,255,255,0.45)",
        boxShadow: "0 30px 80px -40px rgba(0,0,0,0.35)",
        backdropFilter: "blur(26px)",
        WebkitBackdropFilter: "blur(26px)",
      }}
    >
      {children}
    </div>
  );
}
