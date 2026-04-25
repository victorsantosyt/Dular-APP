import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: Stripe.Event;

  if (webhookSecret && !webhookSecret.startsWith("whsec_...")) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    // Sem webhook secret configurado — aceita o payload cru (dev only)
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] erro ao processar evento:", event.type, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  if (!userId) return;

  const metadata = session.metadata ?? {};

  if (session.mode === "subscription") {
    const plan = (metadata.subscriptionPlan || "BASIC") as "BASIC" | "PREMIUM";
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        plan,
        status: "ACTIVE",
        externalId: session.subscription as string,
        startedAt: new Date(),
        expiresAt,
        canceledAt: null,
      },
      create: {
        userId,
        plan,
        status: "ACTIVE",
        externalId: session.subscription as string,
        expiresAt,
      },
    });
  }

  if (session.mode === "payment") {
    const credits = parseInt(metadata.credits || "0", 10);
    if (credits <= 0) return;

    const wallet = await prisma.creditWallet.upsert({
      where: { userId },
      update: { balance: { increment: credits } },
      create: { userId, balance: credits },
    });

    await prisma.creditTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CREDIT",
        amount: credits,
        description: `Compra de ${credits} crédito${credits > 1 ? "s" : ""}`,
      },
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.subscription.updateMany({
    where: { externalId: subscription.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
}
