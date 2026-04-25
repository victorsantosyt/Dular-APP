import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { prisma } from "@/lib/prisma";
import type { OAuthProvider, UserRole } from "@prisma/client";

async function findOrCreateOAuthUser(
  email: string,
  name: string,
  provider: OAuthProvider,
  providerId: string,
) {
  // 1. OAuthAccount já vinculada → retorna o user
  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    select: { user: { select: { id: true, role: true } } },
  });
  if (linked) return linked.user;

  // 2. Email já existe no sistema → vincula a conta OAuth
  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (byEmail) {
    await prisma.oAuthAccount.create({
      data: { userId: byEmail.id, provider, providerId, email },
    });
    return byEmail;
  }

  // 3. Usuário novo — role fica null até ele escolher o perfil
  const created = await prisma.user.create({
    data: {
      nome: name,
      email,
      oauthAccounts: { create: { provider, providerId, email } },
    },
    select: { id: true, role: true },
  });
  return created;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Apple({
      clientId: process.env.APPLE_ID!,
      clientSecret: process.env.APPLE_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile, trigger, session }) {
      // account só está presente no primeiro sign-in
      const providerMap: Record<string, OAuthProvider> = { google: "GOOGLE", apple: "APPLE" };
      const oauthProvider = account?.provider ? providerMap[account.provider] : undefined;

      if (oauthProvider && profile?.email) {
        const user = await findOrCreateOAuthUser(
          profile.email,
          (profile.name as string | undefined) ?? "Usuário",
          oauthProvider,
          account!.providerAccountId,
        );
        if (!user) return token;
        token.userId = user.id;
        token.role = user.role ?? null;
      }

      // Atualiza role quando o cliente chama session.update({ role })
      if (trigger === "update" && (session as { role?: UserRole } | null)?.role) {
        token.role = (session as { role: UserRole }).role;
      }

      // Se role ainda for null mas já temos userId, busca no banco
      if (!token.role && token.userId) {
        const user = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { role: true },
        });
        if (user?.role) token.role = user.role;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.role = (token.role as UserRole | null) ?? null;
      return session;
    },
  },
});
