"use client";

import { Paperclip, RefreshCw, Send, Wifi, WifiOff, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api, apiUrl, Bot, Chat, Message, User } from "../../lib/api";
import { Shell } from "../../components/Shell";

function MessageImage({ message }: { message: Message }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    fetch(`${apiUrl()}/messages/${message.id}/file`, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error("Gambar tidak dapat dimuat");
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [message.id]);

  if (failed) {
    return <a className="file-link" href={`${apiUrl()}/messages/${message.id}/file`} target="_blank" rel="noreferrer"><Paperclip size={16} /> {message.fileName ?? "Gambar"}</a>;
  }
  if (!src) return <span className="image-loading">{message.fileName ?? "Memuat gambar..."}</span>;
  return <img className="message-image" src={src} alt={message.fileName ?? "Gambar"} onError={() => setFailed(true)} />;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("all");
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [sse, setSse] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const activeRef = useRef<Chat | null>(null);
  const searchRef = useRef("");
  const selectedBotIdRef = useRef("all");
  const refreshTimerRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    selectedBotIdRef.current = selectedBotId;
  }, [selectedBotId]);

  function agentTarget(text: string) {
    const match = text.trim().match(/^(Agent_(?:A|B|C|AI))(?:\s+|$)/i);
    if (!match) return undefined;
    const suffix = match[1].split("_")[1]?.toUpperCase();
    return suffix ? `Agent_${suffix}` : undefined;
  }

  async function loadChats(query = search, botId = selectedBotId) {
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      if (botId !== "all") params.set("botId", botId);
      const data = await api<Chat[]>(`/chats${params.size ? `?${params.toString()}` : ""}`);
      setError("");
      setChats(data);
      setActive((current) => {
        if (current && data.some((chat) => chat.id === current.id)) return current;
        return data[0] ?? null;
      });
      return data;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat chat.");
      return [];
    }
  }

  async function loadMessages(chat = active, markRead = false) {
    if (!chat) return;
    try {
      if (markRead) await api(`/chats/${chat.id}/read`, { method: "POST" });
      setMessages(await api<Message[]>(`/chats/${chat.id}/messages`));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat pesan.");
    }
  }

  useEffect(() => {
    api<User>("/auth/me").then(setUser).catch(() => location.replace("/login"));
    api<Bot[]>("/bots").then((data) => setBots(data.filter((bot) => bot.isActive))).catch(() => undefined);
    loadChats("");
  }, []);

  useEffect(() => {
    setMessages([]);
    loadChats(search, selectedBotId);
  }, [selectedBotId]);

  useEffect(() => {
    loadMessages(active, true);
  }, [active?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, active?.id]);

  useEffect(() => {
    const source = new EventSource(`${apiUrl()}/events/stream`, { withCredentials: true });
    const refresh = () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => {
        loadChats(searchRef.current, selectedBotIdRef.current);
        loadMessages(activeRef.current, false);
      }, 250);
    };
    source.onopen = () => setSse(true);
    source.onerror = () => setSse(false);
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as { type?: string; event?: string; data?: { type?: string } };
        const type = event.type ?? event.event ?? event.data?.type;
        if (type === "message.created" || type === "message.updated" || type === "chat.updated") refresh();
      } catch {
        refresh();
      }
    };
    source.addEventListener("message.created", refresh);
    source.addEventListener("message.updated", refresh);
    source.addEventListener("chat.updated", refresh);
    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      source.close();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const text = String(form.get("text") ?? "").trim();
    if (!text && !selectedFile) return;
    const currentChat = active;
    const targetAgent = text ? agentTarget(text) : undefined;
    setSending(true);
    setError("");
    try {
      const clientRequestId = crypto.randomUUID();
      if (selectedFile) {
        const payload = new FormData();
        payload.set("text", text);
        payload.set("clientRequestId", clientRequestId);
        payload.set("file", selectedFile);
        await api(`/chats/${active.id}/messages`, { method: "POST", body: payload });
      } else {
        await api(`/chats/${active.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ text, clientRequestId })
        });
      }
      formElement.reset();
      setSelectedFile(null);
      const latestChats = await loadChats(searchRef.current, selectedBotIdRef.current);
      if (targetAgent && currentChat) {
        const targetChat = latestChats.find(
          (chat) => chat.telegramChatId === currentChat.telegramChatId && chat.bot?.name?.toLowerCase() === targetAgent.toLowerCase()
        );
        if (targetChat) {
          setActive(targetChat);
          return;
        }
      }
      await loadMessages(currentChat, false);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Gagal mengirim pesan.");
    } finally {
      setSending(false);
    }
  }

  const title = useMemo(() => active?.displayName ?? "Pilih percakapan", [active]);

  return (
    <Shell user={user}>
      <main className="inbox">
        <aside className="chat-list">
          <div className="bot-filter">
            <select value={selectedBotId} onChange={(event) => setSelectedBotId(event.target.value)} title="Pilih bot">
              <option value="all">Semua bot</option>
              {bots.map((bot) => (
                <option value={bot.id} key={bot.id}>{bot.name}{bot.username ? ` (@${bot.username})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="search-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadChats()} placeholder="Cari chat" />
            <button className="icon-button" onClick={() => loadChats()} title="Refresh"><RefreshCw size={17} /></button>
          </div>
          {chats.map((chat) => (
            <button className={`chat-item ${active?.id === chat.id ? "active" : ""}`} key={chat.id} onClick={() => setActive(chat)}>
              <span className="chat-name">{chat.displayName}</span>
              <span className="chat-bot">{chat.bot?.name ?? "Bot"}</span>
              <span className="chat-preview">{chat.lastMessage?.content ?? "Belum ada pesan"}</span>
              {chat.unreadCount ? <b>{chat.unreadCount}</b> : null}
            </button>
          ))}
        </aside>
        <section className="conversation">
          <div className="conversation-head">
            <div><h1>{title}</h1><p>{active ? `${active.bot?.name ?? "Bot"} · ${active.username ? `@${active.username}` : "Private chat"}` : "Pilih bot dan percakapan"}</p></div>
            <span className={sse ? "online" : "offline"}>{sse ? <Wifi size={16} /> : <WifiOff size={16} />} SSE</span>
          </div>
          {error ? <p className="chat-error">{error}</p> : null}
          <div className="messages">
            {messages.map((message) => (
              <div className={`bubble ${message.direction === "OUTBOUND" ? "out" : "in"} ${message.type === "PHOTO" ? "media" : ""}`} key={message.id}>
                {message.type === "PHOTO" ? (
                  <MessageImage message={message} />
                ) : null}
                {message.type === "DOCUMENT" ? (
                  <a className="file-link" href={`${apiUrl()}/messages/${message.id}/file`} target="_blank" rel="noreferrer">
                    <Paperclip size={16} /> {message.fileName ?? "Dokumen"}
                  </a>
                ) : null}
                {message.content ? <p>{message.content}</p> : null}
                <small>{message.status}{message.errorMessage ? ` - ${message.errorMessage}` : ""}</small>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form className="composer" onSubmit={submit}>
            <div className="compose-fields">
              <input
                name="text"
                placeholder="Tulis balasan"
                disabled={!active || sending}
                maxLength={4096}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              {selectedFile ? (
                <span className="selected-file">
                  <Paperclip size={14} /> {selectedFile.name}
                  <button type="button" onClick={() => setSelectedFile(null)} title="Hapus file"><X size={14} /></button>
                </span>
              ) : null}
            </div>
            <label className="attach-button" title="Lampirkan file">
              <Paperclip size={18} />
              <input
                type="file"
                name="file"
                disabled={!active || sending}
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button disabled={!active || sending} title="Kirim"><Send size={18} /></button>
          </form>
        </section>
      </main>
    </Shell>
  );
}
