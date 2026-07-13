"use client";

import { Bot, LogOut, MessageSquare, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, User } from "../lib/api";

export function Shell({ user, children }: { user?: User | null; children: React.ReactNode }) {
  const router = useRouter();
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <Bot size={22} />
          <span>Telegram Hub</span>
        </div>
        <nav>
          <Link href="/dashboard" title="Inbox"><MessageSquare size={18} /></Link>
          <Link href="/settings" title="Pengaturan bot"><Settings size={18} /></Link>
          <Link href="/logs" title="Audit log"><ShieldCheck size={18} /></Link>
          <span className="user">{user?.name ?? "Admin"}</span>
          <button className="icon-button" onClick={logout} title="Logout"><LogOut size={18} /></button>
        </nav>
      </header>
      {children}
    </div>
  );
}
