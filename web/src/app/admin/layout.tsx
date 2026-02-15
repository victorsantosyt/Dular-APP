export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // layout neutro; a proteção fica em (protected)/layout.tsx
  return children;
}
