-- Remove duplicated profile-local attributes. User.genero and SafeScore remain the sources of truth.
ALTER TABLE "DiaristaProfile" DROP COLUMN IF EXISTS "genero";
ALTER TABLE "MontadorPerfil" DROP COLUMN IF EXISTS "safeScore";

-- Align profile ownership with DiaristaProfile: profiles should disappear when the owner User is deleted.
ALTER TABLE "EmpregadorPerfil" DROP CONSTRAINT IF EXISTS "EmpregadorPerfil_userId_fkey";
ALTER TABLE "EmpregadorPerfil"
  ADD CONSTRAINT "EmpregadorPerfil_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MontadorPerfil" DROP CONSTRAINT IF EXISTS "MontadorPerfil_userId_fkey";
ALTER TABLE "MontadorPerfil"
  ADD CONSTRAINT "MontadorPerfil_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill profile rows for existing role holders without deleting or overwriting existing data.
INSERT INTO "EmpregadorPerfil" ("id", "userId", "createdAt", "updatedAt")
SELECT
  concat('emp_', md5(u.id || ':empregadorPerfil')),
  u.id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
LEFT JOIN "EmpregadorPerfil" ep ON ep."userId" = u.id
WHERE u.role::text = 'EMPREGADOR'
  AND ep.id IS NULL;

INSERT INTO "DiaristaProfile" ("id", "userId", "precoLeve", "precoMedio", "precoPesada", "createdAt", "updatedAt")
SELECT
  concat('dia_', md5(u.id || ':diaristaProfile')),
  u.id,
  0,
  0,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
LEFT JOIN "DiaristaProfile" dp ON dp."userId" = u.id
WHERE u.role::text = 'DIARISTA'
  AND dp.id IS NULL;

INSERT INTO "MontadorPerfil" (
  "id",
  "userId",
  "especialidades",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('mon_', md5(u.id || ':montadorPerfil')),
  u.id,
  ARRAY[]::TEXT[],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
LEFT JOIN "MontadorPerfil" mp ON mp."userId" = u.id
WHERE u.role::text = 'MONTADOR'
  AND mp.id IS NULL;
