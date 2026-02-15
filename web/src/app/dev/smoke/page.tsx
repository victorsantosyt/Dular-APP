"use client";

// Página de Smoke Test (apenas para uso interno / dev).
// Mantém o fluxo antigo para testar APIs rapidamente.

import { useMemo, useState, type CSSProperties } from "react";

export default function SmokePage() {
  const baseUrl = useMemo(() => "", []);

  const [telefone, setTelefone] = useState("65999990001");
  const [senha, setSenha] = useState("cliente123");
  const [nome, setNome] = useState("Cliente Teste");
  const [role, setRole] = useState<"CLIENTE" | "DIARISTA">("CLIENTE");

  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("DULAR_TOKEN") || "";
  });

  const [cidade, setCidade] = useState("Cuiaba");
  const [uf, setUf] = useState("MT");
  const [bairro, setBairro] = useState("Centro");

  const [diaristaUserId, setDiaristaUserId] = useState("");
  const [servicoId, setServicoId] = useState("");

  const [log, setLog] = useState<string>("");
  const [hydrated] = useState(typeof window !== "undefined");

  function fillClienteSeed() {
    setTelefone("65999990001");
    setSenha("cliente123");
    setNome("Cliente Teste");
    setRole("CLIENTE");
  }

  function fillDiaristaSeed() {
    setTelefone("65999990002");
    setSenha("diarista123");
    setNome("Diarista Teste");
    setRole("DIARISTA");
  }

  function append(title: string, data: unknown) {
    const line = `\n\n=== ${title} ===\n${JSON.stringify(data, null, 2)}`;
    setLog((prev) => (prev ? prev + line : line));
  }

  async function api(path: string, opts: RequestInit = {}) {
    const extraHeaders = (opts.headers as Record<string, string> | undefined) ?? {};
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(baseUrl + path, { ...opts, headers });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  }

  async function handleRegister() {
    const { status, json } = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ nome, telefone, senha, role }),
    });
    append(`REGISTER (${status})`, json);
  }

  async function handleLogin() {
    const { status, json } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ telefone, senha }),
    });
    append(`LOGIN (${status})`, json);

    if ((json as any)?.token) {
      setToken((json as any).token);
      localStorage.setItem("DULAR_TOKEN", (json as any).token);
    }
  }

  async function handleBairros() {
    const { status, json } = await api(
      `/api/bairros?cidade=${encodeURIComponent(cidade)}&uf=${encodeURIComponent(uf)}`
    );
    append(`GET BAIRROS (${status})`, json);
  }

  async function handleBuscarDiaristas() {
    const { status, json } = await api(
      `/api/diaristas/buscar?cidade=${encodeURIComponent(cidade)}&uf=${encodeURIComponent(
        uf
      )}&bairro=${encodeURIComponent(bairro)}`
    );
    append(`BUSCAR DIARISTAS (${status})`, json);

    const first = (json as any)?.diaristas?.[0]?.user?.id;
    if (!diaristaUserId && first) setDiaristaUserId(first);
  }

  async function handleMinhas() {
    const { status, json } = await api("/api/servicos/minhas");
    append(`MINHAS SOLICITAÇÕES (${status})`, json);
  }

  async function handleCriarServico() {
    if (!diaristaUserId) {
      append("CRIAR SERVIÇO", { ok: false, error: "Preencha diaristaUserId (ID do usuário diarista)." });
      return;
    }

    const payload = {
      tipo: "FAXINA",
      categoria: "FAXINA_LEVE",
      dataISO: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      turno: "MANHA",
      cidade,
      uf,
      bairro,
      diaristaUserId,
      temPet: true,
      observacoes: "Teste pelo painel.",
    };

    const { status, json } = await api("/api/servicos", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    append(`CRIAR SERVIÇO (${status})`, json);
    const created = json as { servicoId?: string };
    if (created?.servicoId) setServicoId(created.servicoId);
  }

  async function postServicoAction(action: string, body?: unknown) {
    if (!servicoId) {
      append(`AÇÃO ${action}`, { ok: false, error: "Preencha servicoId." });
      return;
    }
    const { status, json } = await api(`/api/servicos/${servicoId}/${action}`, {
      method: "POST",
      body: body ? JSON.stringify(body) : JSON.stringify({}),
    });
    append(`${action.toUpperCase()} (${status})`, json);
  }

  async function handleDiaristaMe() {
    const { status, json } = await api("/api/diarista/me");
    append(`DIARISTA ME (${status})`, json);
  }

  async function handleSetPrecos() {
    const { status, json } = await api("/api/diarista/precos", {
      method: "POST",
      body: JSON.stringify({ precoLeve: 15000, precoPesada: 22000, bio: "Capricho e pontualidade." }),
    });
    append(`SET PREÇOS (${status})`, json);
  }

  async function handleSetBairros() {
    const { status, json } = await api("/api/diarista/bairros", {
      method: "POST",
      body: JSON.stringify({ cidade, uf, bairros: [bairro] }),
    });
    append(`SET BAIRROS (${status})`, json);
  }

  async function handleSetDisponibilidade() {
    const { status, json } = await api("/api/diarista/disponibilidade", {
      method: "POST",
      body: JSON.stringify({
        slots: [
          { diaSemana: 1, turno: "MANHA" },
          { diaSemana: 1, turno: "TARDE" },
          { diaSemana: 3, turno: "MANHA" },
        ],
      }),
    });
    append(`SET DISPONIBILIDADE (${status})`, json);
  }

  function handleLogout() {
    setToken("");
    if (typeof window !== "undefined") {
      localStorage.removeItem("DULAR_TOKEN");
    }
    append("LOGOUT", { ok: true });
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial", background: "hsl(var(--bg))", color: "hsl(var(--text))" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Dular — API Smoke Test</h1>
      <p style={{ marginTop: 0, color: "hsl(var(--muted))" }}>Valide Auth + Perfil de Diarista + Serviços no navegador.</p>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 1100 }}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Auth</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              Nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} />
            </label>
            <label>
              Telefone
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} style={inputStyle} />
            </label>
            <label>
              Senha
              <input value={senha} onChange={(e) => setSenha(e.target.value)} style={inputStyle} />
            </label>
            <label>
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "CLIENTE" | "DIARISTA")}
                style={inputStyle}
              >
                <option value="CLIENTE">CLIENTE</option>
                <option value="DIARISTA">DIARISTA</option>
              </select>
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleRegister} style={btnStyle}>
                Register
              </button>
              <button onClick={handleLogin} style={btnStyle}>
                Login
              </button>
              <button onClick={handleLogout} style={btnStyle}>
                Logout
              </button>
              <button onClick={fillClienteSeed} style={btnStyle}>
                Usar cliente seed
              </button>
              <button onClick={fillDiaristaSeed} style={btnStyle}>
                Usar diarista seed
              </button>
            </div>

            <div style={{ fontSize: 12, color: token ? "#0a7" : "#999" }}>
              Token: {hydrated ? (token ? "OK (salvo no localStorage)" : "vazio") : "..."}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Local / Busca</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              Cidade
              <input value={cidade} onChange={(e) => setCidade(e.target.value)} style={inputStyle} />
            </label>
            <label>
              UF
              <input value={uf} onChange={(e) => setUf(e.target.value)} style={inputStyle} />
            </label>
            <label>
              Bairro
              <input value={bairro} onChange={(e) => setBairro(e.target.value)} style={inputStyle} />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleBairros} style={btnStyle}>
                Listar bairros
              </button>
              <button onClick={handleBuscarDiaristas} style={btnStyle}>
                Buscar diaristas
              </button>
            </div>

            <label>
              diaristaUserId (preenche com o 1º da busca, ou cole manualmente)
              <input value={diaristaUserId} onChange={(e) => setDiaristaUserId(e.target.value)} style={inputStyle} />
            </label>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Diarista Profile (token de DIARISTA)</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleDiaristaMe} style={btnStyle}>
              GET /diarista/me
            </button>
            <button onClick={handleSetPrecos} style={btnStyle}>
              Set preços
            </button>
            <button onClick={handleSetBairros} style={btnStyle}>
              Set bairros
            </button>
            <button onClick={handleSetDisponibilidade} style={btnStyle}>
              Set disponibilidade
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#666" }}>Logue como DIARISTA para usar esses botões.</p>
        </div>

        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Serviços (token)</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleCriarServico} style={btnStyle}>
              Criar serviço (cliente)
            </button>
            <button onClick={handleMinhas} style={btnStyle}>
              Minhas solicitações
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#666" }}>
            Aceitar/iniciar/concluir/confirmar/avaliar dá pra testar depois ou já no app Expo.
          </p>
          <label style={{ display: "block", marginTop: 10 }}>
            servicoId (auto ao criar; ou cole manualmente)
            <input value={servicoId} onChange={(e) => setServicoId(e.target.value)} style={inputStyle} />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button
              onClick={() => postServicoAction("aceitar", { enderecoCompleto: "Rua X, 123 - Centro" })}
              style={btnStyle}
            >
              Aceitar (diarista)
            </button>

            <button onClick={() => postServicoAction("iniciar")} style={btnStyle}>
              Iniciar (diarista)
            </button>

            <button onClick={() => postServicoAction("concluir")} style={btnStyle}>
              Concluir (diarista)
            </button>

            <button onClick={() => postServicoAction("confirmar")} style={btnStyle}>
              Confirmar (cliente)
            </button>

            <button
              onClick={() =>
                postServicoAction("avaliar", {
                  notaGeral: 5,
                  pontualidade: 5,
                  qualidade: 5,
                  comunicacao: 5,
                  comentario: "Teste: serviço top.",
                })
              }
              style={btnStyle}
            >
              Avaliar (cliente)
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button onClick={() => postServicoAction("recusar")} style={btnStyle}>
              Recusar (diarista)
            </button>

            <button onClick={() => postServicoAction("cancelar", { motivo: "Teste cancelamento" })} style={btnStyle}>
              Cancelar (cliente/diarista)
            </button>
          </div>

          <p style={{ fontSize: 12, color: "#666", marginTop: 10 }}>
            Importante: use o token correto. Aceitar/Iniciar/Concluir/Recusar = diarista. Confirmar/Avaliar = cliente.
          </p>
        </div>
      </section>

      <section style={{ marginTop: 16, maxWidth: 1100 }}>
        <h2>Log</h2>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#0b1220",
            color: "#e2e8f0",
            padding: 16,
            borderRadius: 12,
            minHeight: 260,
            border: "1px solid hsl(var(--border))",
          }}
        >
          {log || "Sem logs ainda. Clique em algum botão acima."}
        </pre>
      </section>
    </main>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: 10,
  borderRadius: 10,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--surface))",
  color: "hsl(var(--text))",
  outline: "none",
};

const btnStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--surface))",
  color: "hsl(var(--text))",
  cursor: "pointer",
};

const cardStyle: CSSProperties = {
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  padding: 16,
  background: "hsl(var(--surface))",
};
