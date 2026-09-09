import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import {
  credenciaisApple,
  credenciaisGoogle,
  exigirAlgumProvider,
  exigirAuthSecret,
} from "@/lib/authEnv";
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

// Conferência na CARGA DO MÓDULO, e não no boot (src/instrumentation.ts).
//
// Dois motivos. O instrumentation é compilado também para o runtime Edge
// quando existe middleware, e este caminho puxa Prisma e jsonwebtoken — foi
// exatamente assim que o deploy foi recusado no #245. E derrubar o boot por
// causa do OAuth tiraria do ar o painel admin e a API do app, que autenticam
// por JWT próprio e não dependem disto.
//
// Não há como escapar da conferência: `auth()` só existe depois que este
// módulo carrega.
exigirAuthSecret();

const providers = [
  credenciaisGoogle(),
  credenciaisApple(),
];
const google = providers[0];
const apple = providers[1];
exigirAlgumProvider(providers.filter(Boolean).length);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Atrás de proxy reverso (ngrok), o host chega via X-Forwarded-Host. Sem isto,
  // o NextAuth v5 rejeita a requisição (UntrustedHost) em produção e a geração
  // do CSRF token falha. Equivale a AUTH_TRUST_HOST=true.
  trustHost: true,
  // Só entra provider com credencial completa. Antes os dois entravam sempre,
  // e o `!` deixava `undefined` chegar ao construtor — daí o `client_id=undefined`
  // que a Apple recebia. Um provider ausente é dito no log, com o nome das
  // variáveis que faltam; ver lib/authEnv.ts.
  providers: [
    ...(google ? [Google(google)] : []),
    // Secret dinâmico (APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY) com
    // fallback para o par estático APPLE_ID/APPLE_SECRET.
    ...(apple ? [Apple(apple)] : []),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile, trigger }) {
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

      // Atualiza o JWT a partir do banco. Nunca confia no role enviado pelo client.
      if (trigger === "update" && token.userId) {
        const user = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { role: true },
        });
        token.role = user?.role ?? null;
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
