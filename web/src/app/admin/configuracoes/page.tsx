"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminTable } from "@/components/admin-ui/AdminTable";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "@/lib/cropper";

type Me = {
  id: string;
  nome: string | null;
  telefone: string;
  email: string | null;
  role: string;
  avatarUrl: string | null;
};

type UserRow = {
  id: string;
  nome: string | null;
  telefone: string;
  role: string;
  createdAt: string;
};

export default function ConfiguracoesPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
const [msg, setMsg] = useState<string>("");
const [cropOpen, setCropOpen] = useState(false);
const [cropSrc, setCropSrc] = useState<string | null>(null);
const [crop, setCrop] = useState({ x: 0, y: 0 });
const [zoom, setZoom] = useState(1);
const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Perfil
  const [nome, setNome] = useState("");
  const avatarFallback = useMemo(() => {
    const initial = (me?.nome || me?.telefone || "U").trim()[0]?.toUpperCase();
    return initial || "U";
  }, [me]);

  // Cadastro admin
  const [novoUsuario, setNovoUsuario] = useState("");
  const [novaSenha, setNovaSenha] = useState("");

  async function loadAll() {
    setMsg("");
    const [rMe, rUsers] = await Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/admin/users?role=ADMIN").then((r) => r.json()).catch(() => null),
    ]);

    if (rMe?.ok) {
      setMe(rMe.user);
      setNome(rMe.user?.nome ?? "");
    }

    if (rUsers?.ok) setUsers(rUsers.users);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function saveProfile() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Erro ao salvar");
      setMe(j.user);
      setMsg("Perfil atualizado.");
    } catch (e: any) {
      setMsg(e?.message || "Falha ao salvar");
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar(file: File) {
    setLoading(true);
    setMsg("");
    try {
      // Pré-validação: limita arquivo muito grande antes de abrir o cropper (~4MB).
      if (file.size > 4 * 1024 * 1024) {
        throw new Error("Imagem muito grande (limite 4MB antes do recorte).");
      }

      const dataUrl = await fileToDataUrl(file);
      setCropSrc(dataUrl);
      setCropOpen(true);
    } catch (e: any) {
      setMsg(e?.message || "Falha no upload");
    } finally {
      setLoading(false);
    }
  }

  async function removeAvatar() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/me/avatar", { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Erro ao remover avatar");

      setMe((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
      setMsg("Avatar removido.");
      window.dispatchEvent(new Event("dular:me-updated"));
    } catch (e: any) {
      setMsg(e?.message || "Falha ao remover");
    } finally {
      setLoading(false);
    }
  }

  async function createAdmin() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/admins/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: novoUsuario.trim(), senha: novaSenha }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Erro ao cadastrar");

      setNovoUsuario("");
      setNovaSenha("");
      await loadAll();
      setMsg("Admin cadastrado.");
    } catch (e: any) {
      setMsg(e?.message || "Falha ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  async function removeAdmin(userId: string) {
    if (!confirm("Remover permissão de ADMIN desse usuário?")) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/admins/demote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Erro ao remover admin");

      await loadAll();
      setMsg("Admin removido.");
    } catch (e: any) {
      setMsg(e?.message || "Falha ao remover");
    } finally {
      setLoading(false);
    }
  }

  async function confirmCropAndUpload() {
    if (!cropSrc || !croppedAreaPixels) return;
    setLoading(true);
    setMsg("");
    try {
      const croppedDataUrl = await getCroppedImg(cropSrc, croppedAreaPixels);
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarDataUrl: croppedDataUrl }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Erro ao enviar avatar");

      setMe((prev) => (prev ? { ...prev, avatarUrl: j.user.avatarUrl } : prev));
      setMsg("Avatar atualizado.");
      window.dispatchEvent(new Event("dular:me-updated"));
      setCropOpen(false);
      setCropSrc(null);
    } catch (e: any) {
      setMsg(e?.message || "Falha no upload");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPage title="" subtitle="">
      <div className="mx-auto max-w-[980px]">
        {msg ? (
          <div className="mb-4 rounded-2xl border border-white/30 bg-white/40 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-900/5">
            {msg}
          </div>
        ) : null}

        {/* Topo: avatar + ações */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-white/50 ring-1 ring-slate-900/10">
            {me?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-600">
                {avatarFallback}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
              <label className="cursor-pointer rounded-xl border border-white/30 bg-white/40 px-4 py-2 text-xs text-slate-700 ring-1 ring-slate-900/5">
                Enviar foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                  }}
                />
              </label>

            <button
              onClick={removeAvatar}
              disabled={loading || !me?.avatarUrl}
              className="rounded-xl border border-white/30 bg-white/40 px-4 py-2 text-xs text-slate-700 ring-1 ring-slate-900/5 disabled:opacity-50"
            >
              Remover
            </button>
          </div>

          <div className="mt-2 text-xs text-slate-500">
            {me?.role ? (
              <>
                Logado como <b className="text-slate-700">{me.role}</b>
              </>
            ) : (
              "Carregando..."
            )}
          </div>
        </div>

        {/* Cropper modal */}
        {cropOpen && cropSrc ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur">
            <div className="w-full max-w-[420px] rounded-2xl border border-white/25 bg-white/90 p-4 shadow-lg ring-1 ring-slate-900/10">
              <div className="relative h-[300px] w-full overflow-hidden rounded-xl bg-slate-100">
                <Cropper
                  image={cropSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                  onZoomChange={setZoom}
                  showGrid={false}
                  zoomWithScroll
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Zoom</label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCropOpen(false);
                      setCropSrc(null);
                    }}
                    className="rounded-xl border border-white/30 bg-white/40 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-900/5 hover:bg-white/55"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmCropAndUpload}
                    disabled={loading}
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-xs font-medium text-white shadow-sm ring-1 ring-white/30 hover:brightness-95 active:brightness-90 disabled:opacity-50"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Card delicado: Nome + salvar */}
        <div className="mt-6 rounded-2xl border border-white/25 bg-white/35 p-4 ring-1 ring-slate-900/5">
          <div className="text-sm font-semibold text-slate-800">Perfil</div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="text-xs text-slate-500">Nome do usuário</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="mt-1 w-full rounded-xl border border-white/20 bg-white/60 px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-slate-900/20"
              />
            </div>

            <button
              onClick={saveProfile}
              disabled={loading}
              className="h-[42px] rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 text-sm font-medium text-white shadow-sm ring-1 ring-white/30 hover:brightness-95 active:brightness-90 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>

        {/* Base inferior: esquerda tabela / direita cadastro */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* ESQ: admins */}
          <div className="rounded-2xl border border-white/25 bg-white/35 p-4 ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">Usuários cadastrados (Admins)</div>
              <button
                onClick={loadAll}
                disabled={loading}
                className="rounded-xl border border-white/30 bg-white/40 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-900/5 hover:bg-white/55 active:bg-white/60 disabled:opacity-50"
              >
                Atualizar
              </button>
            </div>

            <div className="mt-3">
              {users.length === 0 ? (
                <AdminEmpty title="Nenhum admin encontrado" hint="Cadastre um admin ao lado." />
              ) : (
                <AdminTable
                  columns={[
                    { key: "nome", label: "Nome", render: (r: any) => r.nome ?? "—" },
                    { key: "telefone", label: "Usuário" },
                    {
                      key: "actions",
                      label: "Ações",
                      render: (r: any) => (
                        <button
                          onClick={() => removeAdmin(r.id)}
                          disabled={loading || r.id === me?.id}
                          className="rounded-xl border border-white/30 bg-white/40 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-900/5 hover:bg-white/55 active:bg-white/60 disabled:opacity-50"
                        >
                          Remover
                        </button>
                      ),
                    },
                  ]}
                  rows={users}
                />
              )}
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Dica: <b>Remover</b> só tira a permissão de ADMIN (não exclui a conta).
            </div>
          </div>

          {/* DIR: cadastrar admin */}
          <div className="rounded-2xl border border-white/25 bg-white/35 p-4 ring-1 ring-slate-900/5">
            <div className="text-sm font-semibold text-slate-800">Cadastrar admin</div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-slate-500">Usuário</label>
                <input
                  value={novoUsuario}
                  onChange={(e) => setNovoUsuario(e.target.value)}
                  placeholder="Ex: 65999990010"
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/60 px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-slate-900/20"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500">Senha</label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Senha forte"
                  className="mt-1 w-full rounded-xl border border-white/20 bg-white/60 px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-slate-900/5 focus:ring-2 focus:ring-slate-900/20"
                />
              </div>

              <button
                onClick={createAdmin}
                disabled={loading || !novoUsuario.trim() || !novaSenha}
                className="h-[42px] w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 text-sm font-medium text-white shadow-sm ring-1 ring-white/30 hover:brightness-95 active:brightness-90 disabled:opacity-50"
              >
                Cadastrar
              </button>

              <div className="text-xs text-slate-500">
                Cria ou atualiza um usuário como <b>ADMIN</b>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
