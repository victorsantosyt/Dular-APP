"use client";

import { useEffect } from "react";

export default function BillingCancel() {
  useEffect(() => {
    window.location.href = "dular://billing/cancel";
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#E6EDEA]">
      <p className="text-sm text-gray-500">Redirecionando para o app…</p>
    </main>
  );
}
