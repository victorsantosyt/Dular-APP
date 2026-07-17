/**
 * Design System — Dular Admin
 *
 * Arquitetura em 4 camadas:
 *   1. foundations/  — tokens (cores, tipografia, espaço, raio, sombra, motion, semantic)
 *   2. ui/           — componentes atômicos (Button, Input, Card…)
 *   3. patterns/     — combinações (DataTable, PageHeader, StatCard…)
 *   4. layouts/      — estrutura de página (AdminLayout, Sidebar, Header…)
 *
 * Regra: páginas montam componentes de `patterns` e `layouts`.
 * Tailwind cru nas páginas deve tender a zero.
 */

export * from "./foundations";
export * from "./ui";
export * from "./patterns";
export * from "./layouts";
export { cn } from "./utils/cn";
