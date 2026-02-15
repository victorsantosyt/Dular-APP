import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <aside className="fixed left-1/2 bottom-6 -translate-x-1/2 z-30">
        <Sidebar />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <div className="p-6 pb-28">
          <div className="rounded-3xl border border-white/35 bg-white/25 backdrop-blur-2xl shadow-[0_30px_90px_-50px_rgba(0,0,0,0.45)]">
            <div className="space-y-5 p-6">
              <Topbar />
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
