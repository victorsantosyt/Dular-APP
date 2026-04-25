"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function BillingSuccess() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? "";

  useEffect(() => {
    window.location.href = `dular://billing/success?session_id=${encodeURIComponent(sessionId)}`;
  }, [sessionId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#E6EDEA]">
      <p className="text-sm text-gray-500">Redirecionando para o app…</p>
    </main>
  );
}
