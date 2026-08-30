"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminTable } from "@/components/admin-ui/AdminTable";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { Button, Field } from "@/design-system/ui";
import { UserCircle, IdCard, ShieldCheck, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
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
  const [msgErro, setMsgErro] = useState(false);
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
    (setMsgErro(false), setMsg(""));
    const [rMe, rUsers] = await Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/admin/users?role=ADMIN")
        .then((r) => r.json())
        .catch(() => null),
    ]);

    if (rMe?.ok) {
      setMe(rMe.user);
      setNome(rMe.user?.nome ?? "");
    }

    if (rUsers?.ok) setUsers(rUsers.users);
  }

  useEffect(() => {
    // O setMsg("") no início de loadAll é no-op aqui: msg inicia "" no mount,
    // e setState com valor idêntico não re-renderiza (sem cascata).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  async function saveProfile() {
    setLoading(true);
    (setMsgErro(false), setMsg(""));
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Erro ao salvar");
      setMe(j.user);
      (setMsgErro(false), setMsg("Perfil atualizado."));
    } catch (e: any) {
      (setMsgErro(true), setMsg(e?.message || "Falha ao salvar"));
    } finally {
      setLoading(false);
    }
  }

  async function uploadAvatar(file: File) {
    setLoading(true);
    (setMsgErro(false), setMsg(""));
    try {
      // Pré-validação: limita arquivo muito grande antes de abrir o cropper (~4MB).
      if (file.size > 4 * 1024 * 1024) {
        throw new Error("Imagem muito grande (limite 4MB antes do recorte).");
      }

      const dataUrl = await fileToDataUrl(file);
      setCropSrc(dataUrl);
      setCropOpen(true);
    } catch (e: any) {
      (setMsgErro(true), setMsg(e?.message || "Falha no upload"));
    } finally {
      setLoading(false);
    }
  }

  async function removeAvatar() {
    setLoading(true);
    (setMsgErro(false), setMsg(""));
    try {
      const res = await fetch("/api/me/avatar", { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Erro ao remover avatar");

      setMe((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
      (setMsgErro(false), setMsg("Avatar removido."));
      window.dispatchEvent(new Event("dular:me-updated"));
    } catch (e: any) {
      (setMsgErro(true), setMsg(e?.message || "Falha ao remover"));
    } finally {
      setLoading(false);
    }
  }

  async function createAdmin() {
    setLoading(true);
    (setMsgErro(false), setMsg(""));
    try {
      const res = await fetch("/api/admin/admins/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: novoUsuario.trim(),
          senha: novaSenha,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Erro ao cadastrar");

      setNovoUsuario("");
      setNovaSenha("");
      await loadAll();
      (setMsgErro(false), setMsg("Admin cadastrado."));
    } catch (e: any) {
      (setMsgErro(true), setMsg(e?.message || "Falha ao cadastrar"));
    } finally {
      setLoading(false);
    }
  }

  async function removeAdmin(userId: string) {
    if (!confirm("Remover permissão de ADMIN desse usuário?")) return;
    setLoading(true);
    (setMsgErro(false), setMsg(""));
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
      (setMsgErro(true), setMsg(e?.message || "Falha ao remover"));
    } finally {
      setLoading(false);
    }
  }

  async function confirmCropAndUpload() {
    if (!cropSrc || !croppedAreaPixels) return;
    setLoading(true);
    (setMsgErro(false), setMsg(""));
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
      (setMsgErro(true), setMsg(e?.message || "Falha no upload"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPage title="" subtitle="">
      <div className="mx-auto max-w-[900px] space-y-6">
        {msg ? (
          <div
            role="status"
            aria-live="polite"
            className={
              msgErro
                ? "flex items-start gap-2 rounded-lg border border-error/30 bg-error-light px-4 py-3 text-sm text-error-dark"
                : "flex items-start gap-2 rounded-lg border border-success/30 bg-success-light px-4 py-3 text-sm text-success-dark"
            }
          >
            {msgErro ? (
              <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
            )}
            <span>{msg}</span>
          </div>
        ) : null}

        {/* Seção: identidade do administrador */}
        <AdminCard title="Sua conta" icon={UserCircle}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-accent-subtle ring-1 ring-border">
              {me?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-bold text-accent-strong">
                  {avatarFallback}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-fg">
                {me?.nome ?? "Carregando…"}
              </div>
              <div className="mt-0.5 text-xs text-fg-subtle">
                {me?.telefone ?? me?.email ?? ""}
                {me?.role ? (
                  <span className="ml-2 rounded-full bg-accent-subtle px-2 py-0.5 text-eyebrow font-bold uppercase text-accent-strong">
                    {me.role}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg">
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

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={removeAvatar}
                  disabled={loading || !me?.avatarUrl}
                >
                  Remover
                </Button>
              </div>
            </div>
          </div>
        </AdminCard>

        {/* Cropper modal */}
        {cropOpen && cropSrc ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-[420px] rounded-2xl border border-border bg-surface p-4 shadow-lg ring-1 ring-border">
              <div className="relative h-[300px] w-full overflow-hidden rounded-xl bg-surface-subtle">
                <Cropper
                  image={cropSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={(_, areaPixels) =>
                    setCroppedAreaPixels(areaPixels)
                  }
                  onZoomChange={setZoom}
                  showGrid={false}
                  zoomWithScroll
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-fg-subtle">Zoom</label>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setCropOpen(false);
                      setCropSrc(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={confirmCropAndUpload} disabled={loading}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Seção: dados do perfil */}
        <AdminCard title="Perfil" icon={IdCard}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Field
              label="Nome exibido"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
            />
            <Button onClick={saveProfile} disabled={loading}>
              Salvar
            </Button>
          </div>
        </AdminCard>

        {/* Seção: administradores */}
        <AdminCard
          title="Administradores"
          icon={ShieldCheck}
          right={
            <Button variant="secondary" size="sm" onClick={loadAll} disabled={loading}>
              Atualizar
            </Button>
          }
        >
          {users.length === 0 ? (
            <AdminEmpty
              title="Nenhum admin encontrado"
              hint="Cadastre o primeiro administrador abaixo."
            />
          ) : (
            <AdminTable
              columns={[
                { key: "nome", label: "Nome", render: (r: any) => r.nome ?? "—" },
                {
                  key: "telefone",
                  label: "Usuário",
                  render: (r: any) => <span className="tabular-nums">{r.telefone}</span>,
                },
                {
                  key: "actions",
                  label: "",
                  render: (r: any) => (
                    <div className="flex justify-end">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => removeAdmin(r.id)}
                        disabled={loading || r.id === me?.id}
                        title={
                          r.id === me?.id
                            ? "Você não pode remover a própria permissão"
                            : undefined
                        }
                      >
                        Remover
                      </Button>
                    </div>
                  ),
                },
              ]}
              rows={users}
            />
          )}
          <p className="mt-4 text-xs text-fg-subtle">
            <b className="text-fg-muted">Remover</b> só retira a permissão de ADMIN — a conta
            do usuário continua existindo.
          </p>
        </AdminCard>

        {/* Seção: novo administrador */}
        <AdminCard title="Cadastrar administrador" icon={UserPlus}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Usuário (telefone)"
              value={novoUsuario}
              onChange={(e) => setNovoUsuario(e.target.value)}
              placeholder="65999990010"
            />
            <Field
              label="Senha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Senha forte"
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={createAdmin}
              disabled={loading || !novoUsuario.trim() || !novaSenha}
            >
              Cadastrar
            </Button>
            <span className="text-xs text-fg-subtle">
              Cria um usuário novo ou promove um existente a ADMIN.
            </span>
          </div>
        </AdminCard>
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
