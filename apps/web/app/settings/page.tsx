"use client";

import { Edit3, Plug, Plus, RefreshCw, Save, Trash2, X, Zap } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { AiAgent, api, Bot, User } from "../../lib/api";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [bots, setBots] = useState<Bot[]>([]);
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "error" } | null>(null);

  async function load() {
    setUser(await api<User>("/auth/me"));
    setBots(await api<Bot[]>("/bots"));
    setAgents(await api<AiAgent[]>("/ai-agents"));
  }

  useEffect(() => {
    load().catch(() => location.replace("/login"));
  }, []);

  useEffect(() => {
    if (!toast || toast.type === "info") return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function createBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setStatus("");
    try {
      await api("/bots", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          token: form.get("token")
        })
      });
      formElement.reset();
      setStatus("Bot baru tersimpan.");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menyimpan bot.");
    } finally {
      setSaving(false);
    }
  }

  async function createAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setStatus("");
    try {
      await api("/ai-agents", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          provider: form.get("provider"),
          baseUrl: form.get("baseUrl"),
          modelId: form.get("modelId"),
          apiKey: form.get("apiKey")
        })
      });
      formElement.reset();
      setStatus("AI agent baru tersimpan.");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menyimpan AI agent.");
    } finally {
      setSaving(false);
    }
  }

  async function updateAgent(event: FormEvent<HTMLFormElement>, agent: AiAgent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const apiKey = String(form.get("apiKey") ?? "").trim();
    const workspaceAccess = form.get("workspaceAccess") === "on";
    setSaving(true);
    setStatus("");
    try {
      await api(`/ai-agents/${agent.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("name"),
          provider: form.get("provider"),
          baseUrl: form.get("baseUrl"),
          modelId: form.get("modelId"),
          ...(apiKey ? { apiKey } : {}),
          isActive: form.get("isActive") === "on",
          workspaceAccess,
          workspaceRoot: workspaceAccess ? form.get("workspaceRoot") || "." : agent.workspaceRoot || "."
        })
      });
      setEditingAgentId(null);
      setStatus("AI agent berhasil diperbarui.");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal memperbarui AI agent.");
    } finally {
      setSaving(false);
    }
  }

  async function run(label: string, action: () => Promise<unknown>) {
    const processing = `${label} sedang diproses...`;
    setStatus(processing);
    setToast({ message: processing, type: "info" });
    try {
      await action();
      const success = `${label} berhasil.`;
      setStatus(success);
      setToast({ message: success, type: "success" });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label} gagal.`;
      setStatus(message);
      setToast({ message, type: "error" });
    }
  }

  return (
    <Shell user={user}>
      <main className="page-panel">
        {toast ? (
          <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
            <p>{toast.message}</p>
            <button type="button" className="toast-close" onClick={() => setToast(null)} aria-label="Tutup notifikasi">
              <X size={16} />
            </button>
          </div>
        ) : null}
        <div className="settings-grid">
          <form className="settings-form" onSubmit={createBot}>
            <h1>Daftarkan Bot</h1>
            <label>Nama internal<input name="name" placeholder="Contoh: Support Bot" required /></label>
            <label>Token bot<input name="token" placeholder="Token dari BotFather" required /></label>
            <div className="actions">
              <button disabled={saving}><Plus size={18} /> Tambah Bot</button>
            </div>
            {status ? <p className="status-line">{status}</p> : null}
          </form>

          <section className="bot-registry">
            <div className="section-head">
              <h1>Bot Terdaftar</h1>
              <button className="secondary-button" onClick={() => load()}><RefreshCw size={18} /> Refresh</button>
            </div>
            {status ? <p className="status-line">{status}</p> : null}
            <div className="bot-cards">
              {bots.map((bot) => (
                <article className="bot-card" key={bot.id}>
                  <div>
                    <h2>{bot.name}</h2>
                    <p>{bot.username ? `@${bot.username}` : "Username belum dites"} · {bot.isActive ? "Aktif" : "Nonaktif"}</p>
                  </div>
                  <dl>
                    <dt>Token</dt><dd>{bot.tokenMasked ?? "-"}</dd>
                    <dt>Webhook</dt><dd>{bot.webhookUrl ?? "-"}</dd>
                    <dt>Last check</dt><dd>{bot.lastCheckedAt ? new Date(bot.lastCheckedAt).toLocaleString() : "-"}</dd>
                  </dl>
                  <div className="actions">
                    <button type="button" onClick={() => run("Test bot", () => api(`/bots/${bot.id}/test`, { method: "POST" }))}><Zap size={18} /> Test</button>
                    <button type="button" onClick={() => run("Sync pesan", () => api(`/webhooks/telegram/${bot.id}/sync`, { method: "POST" }))}><RefreshCw size={18} /> Sync</button>
                    <button type="button" onClick={() => run("Pasang webhook", () => api(`/bots/${bot.id}/webhook`, { method: "POST" }))}><Plug size={18} /> Webhook</button>
                    <button type="button" onClick={() => run("Hapus webhook", () => api(`/bots/${bot.id}/webhook`, { method: "DELETE" }))}><Trash2 size={18} /> Hapus</button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => run("Ubah status bot", () => api(`/bots/${bot.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !bot.isActive }) }))}
                    >
                      <Save size={18} /> {bot.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </div>
                </article>
              ))}
              {bots.length === 0 ? <p className="empty-state">Belum ada bot terdaftar.</p> : null}
            </div>
          </section>

          <form className="settings-form" onSubmit={createAgent}>
            <h1>Daftarkan AI Agent</h1>
            <label>Nama agent<input name="name" placeholder="Contoh: Agent_A" required /></label>
            <label>Provider<input name="provider" defaultValue="OpenAI Compatible" required /></label>
            <label>Base URL<input name="baseUrl" placeholder="https://router.example/v1" required /></label>
            <label>Model ID<input name="modelId" placeholder="Agent_A" required /></label>
            <label>API key<input name="apiKey" type="password" placeholder="sk-..." required /></label>
            <div className="actions">
              <button disabled={saving}><Plus size={18} /> Tambah Agent</button>
            </div>
          </form>

          <section className="bot-registry">
            <div className="section-head">
              <h1>AI Agent Terdaftar</h1>
              <button className="secondary-button" onClick={() => load()}><RefreshCw size={18} /> Refresh</button>
            </div>
            {status ? <p className="status-line">{status}</p> : null}
            <div className="bot-cards">
              {agents.map((agent) => (
                <article className="bot-card" key={agent.id}>
                  {editingAgentId === agent.id ? (
                    <form className="agent-edit-form" onSubmit={(event) => updateAgent(event, agent)}>
                      <div className="section-head">
                        <h2>Edit {agent.name}</h2>
                        <button type="button" className="secondary-button" onClick={() => setEditingAgentId(null)}><X size={18} /> Batal</button>
                      </div>
                      <label>Nama agent<input name="name" defaultValue={agent.name} required /></label>
                      <label>Provider<input name="provider" defaultValue={agent.provider} required /></label>
                      <label>Base URL<input name="baseUrl" defaultValue={agent.baseUrl} required /></label>
                      <label>Model ID<input name="modelId" defaultValue={agent.modelId} required /></label>
                      <label>API key baru<input name="apiKey" type="password" placeholder="Kosongkan jika tidak diganti" /></label>
                      <label>Workspace root<input name="workspaceRoot" defaultValue={agent.workspaceRoot || "."} placeholder="." /></label>
                      <label className="check"><input name="isActive" type="checkbox" defaultChecked={agent.isActive} /> Agent aktif</label>
                      <label className="check"><input name="workspaceAccess" type="checkbox" defaultChecked={agent.workspaceAccess} /> Akses workspace aktif</label>
                      <div className="actions">
                        <button disabled={saving}><Save size={18} /> Simpan</button>
                        <button type="button" className="secondary-button" onClick={() => setEditingAgentId(null)}><X size={18} /> Batal</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div>
                        <h2>{agent.name}</h2>
                        <p>{agent.provider} · {agent.modelId} · {agent.isActive ? "Aktif" : "Nonaktif"}</p>
                      </div>
                      <dl>
                        <dt>Base URL</dt><dd>{agent.baseUrl}</dd>
                        <dt>API key</dt><dd>{agent.apiKeyMasked ?? "-"}</dd>
                        <dt>Workspace</dt><dd>{agent.workspaceAccess ? `Aktif · ${agent.workspaceRoot || "."}` : "Nonaktif"}</dd>
                        <dt>Last check</dt><dd>{agent.lastCheckedAt ? new Date(agent.lastCheckedAt).toLocaleString() : "-"}</dd>
                        <dt>Error</dt><dd>{agent.lastError ?? "-"}</dd>
                      </dl>
                      <div className="actions">
                        <button type="button" onClick={() => run("Test AI agent", () => api(`/ai-agents/${agent.id}/test`, { method: "POST" }))}><Zap size={18} /> Test</button>
                        <button type="button" className="secondary-button" onClick={() => setEditingAgentId(agent.id)}><Edit3 size={18} /> Edit</button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => run("Ubah status AI agent", () => api(`/ai-agents/${agent.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !agent.isActive }) }))}
                        >
                          <Save size={18} /> {agent.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            run(
                              "Ubah akses workspace",
                              () =>
                                api(`/ai-agents/${agent.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ workspaceAccess: !agent.workspaceAccess, workspaceRoot: agent.workspaceRoot || "." })
                                })
                            )
                          }
                        >
                          <Save size={18} /> {agent.workspaceAccess ? "Matikan Workspace" : "Aktifkan Workspace"}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            run(
                              "Set root web",
                              () =>
                                api(`/ai-agents/${agent.id}`, {
                                  method: "PATCH",
                                  body: JSON.stringify({ workspaceAccess: true, workspaceRoot: "apps/web" })
                                })
                            )
                          }
                        >
                          <Plug size={18} /> Root apps/web
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
              {agents.length === 0 ? <p className="empty-state">Belum ada AI agent terdaftar.</p> : null}
            </div>
          </section>
        </div>
      </main>
    </Shell>
  );
}
