import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";

type SubscriptionData = {
  plan: string;
  status: string;
  startedAt: string | null;
  expiresAt: string | null;
  canceledAt: string | null;
} | null;

type UsageData = {
  used: number;
  limit: number | null;
  allowed: boolean;
};

type SubscriptionState = {
  loading: boolean;
  plan: string;
  status: string | null;
  subscription: SubscriptionData;
  usage: { solicitacoesMes: UsageData } | null;
  isBlocked: boolean;
  refresh: () => Promise<void>;
};

export function useSubscription(): SubscriptionState {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string>("FREE");
  const [status, setStatus] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData>(null);
  const [usage, setUsage] = useState<{ solicitacoesMes: UsageData } | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{
        ok: boolean;
        plan: string;
        subscription: SubscriptionData;
        usage: { solicitacoesMes: UsageData };
      }>("/api/me/subscription");

      const data = res.data;
      setPlan(data.plan ?? "FREE");
      setStatus(data.subscription?.status ?? null);
      setSubscription(data.subscription ?? null);
      setUsage(data.usage ?? null);
    } catch {
      // falha silenciosa — mantém FREE por segurança
      setPlan("FREE");
      setStatus(null);
      setSubscription(null);
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const isBlocked = usage?.solicitacoesMes.allowed === false;

  return { loading, plan, status, subscription, usage, isBlocked, refresh: fetch };
}
