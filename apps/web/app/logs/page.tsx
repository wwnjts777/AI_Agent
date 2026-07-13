"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/Shell";
import { api, User } from "../../lib/api";

type AuditLog = {
  id: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: string;
  createdAt: string;
  actor?: { email: string; name: string } | null;
};

export default function LogsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    Promise.all([api<User>("/auth/me"), api<AuditLog[]>("/audit-logs")])
      .then(([me, data]) => {
        setUser(me);
        setLogs(data);
      })
      .catch(() => location.replace("/login"));
  }, []);

  return (
    <Shell user={user}>
      <main className="page-panel">
        <h1>Audit Log</h1>
        <table>
          <thead><tr><th>Waktu</th><th>Admin</th><th>Aksi</th><th>Target</th><th>Detail</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.actor?.email ?? "system"}</td>
                <td>{log.action}</td>
                <td>{[log.targetType, log.targetId].filter(Boolean).join(": ")}</td>
                <td>{log.metadata ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </Shell>
  );
}
