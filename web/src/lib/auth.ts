import jwt from "jsonwebtoken";

// Lido em RUNTIME (não no import): o throw no topo do módulo derrubava o
// `next build`, que avalia as rotas sem as envs de execução.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET env var is required");
  }
  return secret;
}

export type JwtPayload = {
  userId: string;
  role: "EMPREGADOR" | "DIARISTA" | "MONTADOR" | "ADMIN";
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}
