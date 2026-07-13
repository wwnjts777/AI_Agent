import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@telegram-hub/database";
import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import { basename, relative, resolve, sep } from "path";
import { AuditService } from "../audit/audit.service";
import { TokenCryptoService } from "../bots/token-crypto.service";
import { CreateAiAgentDto, UpdateAiAgentDto } from "./ai-agents.dto";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
};

type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

@Injectable()
export class AiAgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: TokenCryptoService,
    private readonly audit: AuditService
  ) {}

  private safe(agent: {
    id: string;
    name: string;
    provider: string;
    baseUrl: string;
    modelId: string;
    apiKeyLast4: string | null;
    isActive: boolean;
    workspaceAccess: boolean;
    workspaceRoot: string | null;
    lastCheckedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: agent.id,
      name: agent.name,
      provider: agent.provider,
      baseUrl: agent.baseUrl,
      modelId: agent.modelId,
      apiKeyMasked: this.crypto.mask(agent.apiKeyLast4),
      isActive: agent.isActive,
      workspaceAccess: agent.workspaceAccess,
      workspaceRoot: agent.workspaceRoot,
      lastCheckedAt: agent.lastCheckedAt,
      lastError: agent.lastError,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    };
  }

  private completionContent(raw: string) {
    const trimmed = raw.trim();
    const candidates = [
      trimmed.replace(/\s*data:\s*\[DONE\]\s*$/u, "").trim(),
      trimmed
        .split(/\r?\n/u)
        .filter((line) => line.startsWith("data:") && !line.includes("[DONE]"))
        .map((line) => line.replace(/^data:\s*/u, ""))
        .join("")
        .trim()
    ].filter(Boolean);

    for (const candidate of candidates) {
      try {
        const body = JSON.parse(candidate) as ChatCompletionResponse & { error?: { message?: string } };
        const content = body.choices?.[0]?.message?.content?.trim() ?? body.choices?.[0]?.delta?.content?.trim();
        if (content) return this.cleanModelOutput(content);
      } catch {
        // Try next shape.
      }
    }
    const streamedContent = trimmed
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:") && !line.includes("[DONE]"))
      .map((line) => line.replace(/^data:\s*/u, "").trim())
      .map((line) => {
        try {
          const body = JSON.parse(line) as ChatCompletionResponse;
          return body.choices?.[0]?.delta?.content ?? body.choices?.[0]?.message?.content ?? "";
        } catch {
          return "";
        }
      })
      .join("")
      .trim();
    if (streamedContent) return this.cleanModelOutput(streamedContent);
    if (trimmed && !trimmed.startsWith("{") && !trimmed.startsWith("[") && !trimmed.startsWith("data:")) {
      return this.cleanModelOutput(trimmed);
    }
    throw new Error("Respons AI agent tidak dapat dibaca");
  }

  private cleanModelOutput(content: string) {
    const toolTags = "web_search|search|query|thinking|tool|function_call|read_file|write_file|edit_file|apply_patch|execute_command|shell|bash";
    const hadToolMarkup = new RegExp(`<(?:${toolTags})\\b`, "iu").test(content);
    const cleaned = content
      .replace(new RegExp(`<(${toolTags})\\b[^>]*>[\\s\\S]*?<\\/\\1>`, "giu"), "")
      .replace(new RegExp(`<\\/?(?:${toolTags})\\b[^>]*>`, "giu"), "")
      .replace(/\n{3,}/gu, "\n\n")
      .trim();
    if (cleaned) return this.limitModelOutput(cleaned);
    if (hadToolMarkup) {
      return "Saya belum punya akses pencarian web real-time dari aplikasi ini. Ulangi perintah dengan data yang ingin dianalisis, atau tanyakan hal lain yang tidak membutuhkan data real-time.";
    }
    return cleaned;
  }

  private limitModelOutput(content: string) {
    const limit = 3600;
    if (content.length <= limit) return content;
    return `${content.slice(0, limit).trim()}\n\n[Jawaban dipersingkat agar bisa dikirim di Telegram.]`;
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 25_000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private providerError(raw: string, fallback: string) {
    try {
      const body = JSON.parse(raw) as { error?: { message?: string }; message?: string };
      return body.error?.message ?? body.message ?? fallback;
    } catch {
      return raw.trim() || fallback;
    }
  }

  private workspaceBase() {
    return resolve(process.env.WORKSPACE_ROOT ?? resolve(process.cwd(), "../.."));
  }

  private workspaceRoot(root?: string | null) {
    const base = this.workspaceBase();
    const requested = root?.trim() || ".";
    const resolved = resolve(base, requested);
    const relativePath = relative(base, resolved);
    if (relativePath.startsWith("..") || relativePath === ".." || relativePath.split(sep).includes("..")) return base;
    return resolved;
  }

  private ignoredWorkspacePath(path: string) {
    const parts = path.split(sep);
    return parts.some((part) =>
      [".git", ".next", ".tools", "dist", "node_modules", "storage", ".turbo", "coverage"].includes(part)
    );
  }

  private async workspaceFiles(root: string, current = root, files: string[] = []) {
    if (files.length >= 300) return files;
    let entries: Array<{ name: string; isDirectory(): boolean }>;
    try {
      entries = (await readdir(current, { withFileTypes: true })) as Array<{ name: string; isDirectory(): boolean }>;
    } catch {
      return files;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = resolve(current, entry.name);
      if (this.ignoredWorkspacePath(absolute)) continue;
      if (entry.isDirectory()) {
        await this.workspaceFiles(root, absolute, files);
      } else if (/\.(ts|tsx|js|jsx|json|css|md|prisma|sql)$/i.test(entry.name)) {
        files.push(relative(root, absolute));
      }
      if (files.length >= 300) break;
    }
    return files;
  }

  private workspaceRelative(absolute: string) {
    const base = this.workspaceBase();
    const relativePath = relative(base, absolute);
    if (relativePath.startsWith("..") || relativePath === ".." || relativePath.split(sep).includes("..")) return undefined;
    return relativePath || ".";
  }

  private async isReadableWorkspaceDirectory(absolute: string) {
    const relativePath = this.workspaceRelative(absolute);
    if (!relativePath || this.ignoredWorkspacePath(absolute)) return false;
    try {
      return (await stat(absolute)).isDirectory();
    } catch {
      return false;
    }
  }

  private folderListingRequest(prompt: string) {
    const normalized = prompt.toLowerCase();
    if (this.folderCreationRequest(normalized)) return false;
    return (
      /(sebutkan|tampilkan|lihatkan|list|daftar).*(isi|file|folder|struktur|workspace|direktori)/iu.test(normalized) ||
      /(isi|file|folder|struktur|workspace|direktori).*(aplikasi|project|proyek|workspace)/iu.test(normalized)
    );
  }

  private folderCreationRequest(prompt: string) {
    return /(buat|buatkan|tambahkan|create|add).*(folder|direktori)/iu.test(prompt);
  }

  private requestedFolderName(prompt: string) {
    const patterns = [
      /nama\s+folder(?:nya)?\s+([a-z0-9_.-]+)/iu,
      /folder(?:nya)?\s+([a-z0-9_.-]+)$/iu
    ];
    for (const pattern of patterns) {
      const raw = prompt.match(pattern)?.[1]?.trim().replace(/[.,;:!?]+$/u, "");
      if (!raw) continue;
      const normalized = raw.replace(/^\/+|\/+$/gu, "");
      if (/^[a-z0-9_.-]+$/iu.test(normalized) && !["folder", "direktori", "aplikasi"].includes(normalized.toLowerCase())) {
        return normalized;
      }
    }
    return undefined;
  }

  private async workspaceFolderCreationAnswer(
    agentName: string,
    prompt: string,
    agent: { workspaceAccess: boolean; workspaceRoot: string | null }
  ) {
    if (!agent.workspaceAccess || !this.folderCreationRequest(prompt)) return undefined;
    const folderName = this.requestedFolderName(prompt);
    if (!folderName) {
      return `${agentName} belum menemukan nama folder yang valid. Ulangi dengan format: ${agentName} buatkan folder dengan nama coba`;
    }

    const baseRoot = this.workspaceRoot(agent.workspaceRoot);
    const target = resolve(baseRoot, folderName);
    const relativePath = this.workspaceRelative(target);
    if (!relativePath || this.ignoredWorkspacePath(target) || folderName.includes("..")) {
      return `${agentName} tidak bisa membuat folder "${folderName}" karena path tidak aman atau termasuk folder yang dilarang.`;
    }

    await mkdir(target, { recursive: true });
    await writeFile(resolve(target, ".gitkeep"), "", { flag: "a" });
    return [
      `${agentName} sudah membuat folder.`,
      `Path: ${relativePath}`,
      "File penjaga: .gitkeep"
    ].join("\n");
  }

  private netWatchTaskCommand(prompt: string) {
    const match = prompt.match(/\b(NW-\d{3})\b/iu);
    if (!match) return undefined;
    const normalized = prompt.toLowerCase();
    if (!/(mulai|kerjakan|jalankan|review|perbaiki|fix)/iu.test(normalized)) return undefined;
    return {
      taskId: match[1].toUpperCase(),
      action: normalized.includes("review") ? "review" : normalized.includes("perbaiki") || normalized.includes("fix") ? "fix" : "start"
    };
  }

  private netWatchRoot() {
    return resolve(this.workspaceBase(), "apps/test_ping");
  }

  private async writeIfMissing(path: string, content: string) {
    try {
      await stat(path);
      return false;
    } catch {
      await mkdir(resolve(path, ".."), { recursive: true });
      await writeFile(path, content);
      return true;
    }
  }

  private async scaffoldNetWatchNw001() {
    const root = this.netWatchRoot();
    const files: Array<[string, string]> = [
      [
        "package.json",
        `${JSON.stringify(
          {
            name: "@netwatch/root",
            private: true,
            version: "0.1.0",
            scripts: {
              dev: "pnpm -r --parallel dev",
              build: "pnpm -r build",
              lint: "pnpm -r lint",
              test: "pnpm -r test"
            },
            packageManager: "pnpm@9.15.0"
          },
          null,
          2
        )}\n`
      ],
      ["pnpm-workspace.yaml", "packages:\n  - apps/*\n  - packages/*\n"],
      [
        ".env.example",
        "API_PORT=4101\nWEB_PORT=4100\nVITE_API_URL=http://localhost:4101\n"
      ],
      [
        ".gitignore",
        "node_modules\ndist\n.env\n*.db\n*.db-shm\n*.db-wal\n"
      ],
      [
        "README.md",
        [
          "# NetWatch",
          "",
          "Web-based IP monitoring dashboard.",
          "",
          "## Development",
          "",
          "```bash",
          "pnpm install",
          "pnpm dev",
          "```",
          "",
          "API health endpoint:",
          "",
          "```text",
          "GET http://localhost:4101/health",
          "```",
          ""
        ].join("\n")
      ],
      [
        "apps/api/package.json",
        `${JSON.stringify(
          {
            name: "@netwatch/api",
            private: true,
            version: "0.1.0",
            type: "module",
            scripts: {
              dev: "node --watch src/server.js",
              build: "node --check src/server.js",
              lint: "node --check src/server.js",
              test: "NODE_ENV=test node --test"
            },
            dependencies: {
              cors: "^2.8.5",
              express: "^4.19.2"
            },
            devDependencies: {
              "@types/node": "^20.18.2"
            }
          },
          null,
          2
        )}\n`
      ],
      [
        "apps/api/src/server.js",
        [
          "import cors from \"cors\";",
          "import express from \"express\";",
          "",
          "export function createApp() {",
          "  const app = express();",
          "  app.use(cors());",
          "  app.use(express.json());",
          "",
          "  app.get(\"/health\", (_request, response) => {",
          "    response.json({ status: \"ok\", service: \"netwatch-api\" });",
          "  });",
          "",
          "  return app;",
          "}",
          "",
          "if (process.env.NODE_ENV !== \"test\") {",
          "  const port = Number(process.env.API_PORT ?? 4101);",
          "  createApp().listen(port, () => {",
          "    console.log(`netwatch-api listening on ${port}`);",
          "  });",
          "}",
          ""
        ].join("\n")
      ],
      [
        "apps/api/test/health.test.js",
        [
          "import assert from \"node:assert/strict\";",
          "import test from \"node:test\";",
          "import { createApp } from \"../src/server.js\";",
          "",
          "test(\"GET /health returns ok\", async () => {",
          "  const server = createApp().listen(0);",
          "  const address = server.address();",
          "  try {",
          "    const response = await fetch(`http://127.0.0.1:${address.port}/health`);",
          "    assert.equal(response.status, 200);",
          "    assert.deepEqual(await response.json(), { status: \"ok\", service: \"netwatch-api\" });",
          "  } finally {",
          "    server.close();",
          "  }",
          "});",
          ""
        ].join("\n")
      ],
      [
        "apps/web/package.json",
        `${JSON.stringify(
          {
            name: "@netwatch/web",
            private: true,
            version: "0.1.0",
            type: "module",
            scripts: {
              dev: "vite --host 0.0.0.0 --port ${WEB_PORT:-4100}",
              build: "vite build",
              lint: "vite build --mode development --outDir /tmp/netwatch-web-lint",
              test: "node --test"
            },
            dependencies: {
              "@vitejs/plugin-react": "^4.3.4",
              vite: "^5.4.19",
              react: "^18.3.1",
              "react-dom": "^18.3.1"
            }
          },
          null,
          2
        )}\n`
      ],
      [
        "apps/web/index.html",
        "<!doctype html>\n<html lang=\"id\">\n  <head><meta charset=\"UTF-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" /><title>NetWatch</title></head>\n  <body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.jsx\"></script></body>\n</html>\n"
      ],
      [
        "apps/web/src/main.jsx",
        [
          "import React from \"react\";",
          "import { createRoot } from \"react-dom/client\";",
          "import \"./styles.css\";",
          "",
          "function App() {",
          "  return (",
          "    <main className=\"app-shell\">",
          "      <section className=\"hero\">",
          "        <p>NetWatch</p>",
          "        <h1>Dashboard monitoring IP</h1>",
          "        <span>Project setup siap. Lanjutkan task NW-002 untuk quality foundation.</span>",
          "      </section>",
          "    </main>",
          "  );",
          "}",
          "",
          "createRoot(document.getElementById(\"root\")).render(<App />);",
          ""
        ].join("\n")
      ],
      [
        "apps/web/src/styles.css",
        [
          ":root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #eef2f6; color: #152238; }",
          "body { margin: 0; }",
          ".app-shell { min-height: 100vh; display: grid; place-items: center; padding: 24px; }",
          ".hero { width: min(720px, 100%); border: 1px solid #d8e0ea; border-radius: 8px; background: #fff; padding: 28px; box-shadow: 0 16px 44px rgb(21 34 56 / 10%); }",
          ".hero p { margin: 0 0 10px; color: #00897b; font-weight: 700; }",
          ".hero h1 { margin: 0 0 14px; font-size: 34px; }",
          ".hero span { color: #516173; }",
          ""
        ].join("\n")
      ],
      ["apps/web/test/basic.test.js", "import test from \"node:test\";\n\ntest(\"web test placeholder\", () => {});\n"],
      ["packages/.gitkeep", ""],
      ["docs/requirements/NW-001.md", "# NW-001 Project Setup\n\nAcceptance Criteria mengikuti NetWatch_3_Agent_Step_by_Step.md.\n"],
      [
        "docs/handoffs/NW-001-agent-a.md",
        [
          "# Agent A Handoff",
          "",
          "Task ID: NW-001",
          "Status: Ready for Review",
          "",
          "## Yang Dikerjakan",
          "",
          "- Membuat struktur workspace NetWatch di apps/test_ping.",
          "- Menambahkan API Express dengan endpoint GET /health.",
          "- Menambahkan frontend React + Vite awal.",
          "- Menambahkan README, .env.example, dan script root.",
          "",
          "## Test",
          "",
          "- pnpm lint: belum dijalankan oleh bot runtime",
          "- pnpm test: belum dijalankan oleh bot runtime",
          "- pnpm build: belum dijalankan oleh bot runtime",
          "",
          "## Catatan",
          "",
          "Jalankan pemeriksaan lokal sebelum Agent_B review.",
          ""
        ].join("\n")
      ]
    ];

    const created: string[] = [];
    for (const [relativePath, content] of files) {
      const didCreate = await this.writeIfMissing(resolve(root, relativePath), content);
      if (didCreate) created.push(relativePath);
    }
    return created;
  }

  private async netWatchWorkflowAnswer(agentName: string, prompt: string, agent: { workspaceAccess: boolean; workspaceRoot: string | null }) {
    if (!agent.workspaceAccess) return undefined;
    const command = this.netWatchTaskCommand(prompt);
    if (!command) return undefined;
    if (command.taskId !== "NW-001") {
      return `${agentName} sudah membaca workflow NetWatch. Untuk saat ini eksekusi otomatis baru tersedia untuk NW-001.`;
    }
    if (command.action === "review") {
      return `${agentName} mode review: jalankan Agent_B review setelah Agent_A membuat NW-001 dan semua test lokal dijalankan.`;
    }
    if (command.action === "fix") {
      return `${agentName} mode fix: Agent_C membutuhkan laporan review Agent_B sebelum memperbaiki NW-001.`;
    }
    if (agentName !== "Agent_A") {
      return `Task NW-001 harus dimulai oleh Agent_A. Gunakan: Agent_A mulai task NW-001`;
    }
    const created = await this.scaffoldNetWatchNw001();
    return [
      "Agent_A menjalankan task NW-001 Project Setup.",
      created.length ? "File/folder yang dibuat:" : "Struktur NW-001 sudah ada, tidak ada file baru dibuat.",
      ...created.map((file) => `- apps/test_ping/${file}`),
      "",
      "Langkah berikutnya: jalankan pnpm install, pnpm lint, pnpm test, dan pnpm build di apps/test_ping, lalu minta Agent_B review task NW-001."
    ].join("\n");
  }

  private requestedWorkspacePath(prompt: string) {
    const patterns = [
      /(?:folder|direktori|path)\s+([./]?[a-z0-9_./-]+)/iu,
      /(?:di|dalam)\s+([./]?[a-z0-9_./-]+)/iu
    ];
    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      const raw = match?.[1]?.trim().replace(/[.,;:!?]+$/u, "");
      if (!raw || ["folder", "direktori", "path", "aplikasi", "project", "proyek", "workspace"].includes(raw.toLowerCase())) {
        continue;
      }
      const normalized = raw.replace(/^\/+|\/+$/gu, "");
      if (normalized && !normalized.includes("..")) return normalized;
    }
    return undefined;
  }

  private previousWorkspaceRoot(conversationContext: ConversationTurn[]) {
    for (const turn of [...conversationContext].reverse()) {
      const match = turn.content.match(/Workspace root:\s*([^\n]+)/iu);
      const root = match?.[1]?.trim();
      if (root && root !== "." && !root.includes("..")) return root.replace(/^\/+/u, "");
    }
    return undefined;
  }

  private async resolveListingRoot(
    requestedPath: string | undefined,
    baseRoot: string,
    conversationContext: ConversationTurn[]
  ) {
    if (!requestedPath) return { root: baseRoot };

    const base = this.workspaceBase();
    const previousRoot = this.previousWorkspaceRoot(conversationContext);
    const candidates = [
      previousRoot && !requestedPath.includes("/") ? resolve(base, previousRoot, requestedPath) : undefined,
      resolve(base, requestedPath),
      resolve(baseRoot, requestedPath)
    ].filter(Boolean) as string[];

    for (const candidate of [...new Set(candidates)]) {
      if (await this.isReadableWorkspaceDirectory(candidate)) return { root: candidate };
    }

    const suggested = previousRoot && !requestedPath.includes("/") ? `${previousRoot}/${requestedPath}` : undefined;
    return {
      error: [
        `Folder "${requestedPath}" tidak ditemukan atau tidak boleh dibaca.`,
        suggested ? `Jika yang dimaksud folder sebelumnya, coba tulis: /${suggested}` : "Gunakan path lengkap, contoh: /apps/api/src atau /apps/web/app."
      ].join("\n")
    };
  }

  private formatFileTree(files: string[]) {
    const tree: Record<string, unknown> = {};
    for (const file of files) {
      const parts = file.split(/[\\/]+/u).filter(Boolean);
      let cursor = tree;
      for (const [index, part] of parts.entries()) {
        const key = index === parts.length - 1 ? part : `${part}/`;
        cursor[key] ??= {};
        cursor = cursor[key] as Record<string, unknown>;
      }
    }

    const lines: string[] = [];
    const walk = (node: Record<string, unknown>, depth = 0) => {
      for (const key of Object.keys(node).sort((left, right) => left.localeCompare(right))) {
        lines.push(`${"  ".repeat(depth)}- ${key}`);
        const child = node[key] as Record<string, unknown>;
        if (key.endsWith("/")) walk(child, depth + 1);
      }
    };
    walk(tree);
    return lines;
  }

  private async workspaceListingAnswer(
    agentName: string,
    prompt: string,
    agent: { workspaceAccess: boolean; workspaceRoot: string | null },
    conversationContext: ConversationTurn[]
  ) {
    if (!agent.workspaceAccess || !this.folderListingRequest(prompt)) return undefined;
    const baseRoot = this.workspaceRoot(agent.workspaceRoot);
    const requestedPath = this.requestedWorkspacePath(prompt);
    const resolvedRoot = await this.resolveListingRoot(requestedPath, baseRoot, conversationContext);
    if (resolvedRoot.error || !resolvedRoot.root) {
      return [
        `${agentName} tidak bisa membaca folder yang diminta.`,
        resolvedRoot.error ?? "Folder target tidak ditemukan.",
        "",
        "Catatan: folder runtime/rahasia seperti .git, node_modules, .next, dist, storage, .tools, dan coverage sengaja tidak dibaca."
      ].join("\n");
    }
    const root = resolvedRoot.root;
    const files = await this.workspaceFiles(root);
    const rootLabel = relative(this.workspaceBase(), root) || ".";
    const visibleFiles = files.slice(0, 160);
    const hiddenCount = files.length - visibleFiles.length;
    const tree = this.formatFileTree(visibleFiles);
    return [
      `${agentName} membaca langsung folder aplikasi dari server.`,
      `Workspace root: ${rootLabel}`,
      "",
      "Daftar file yang dapat dibaca:",
      ...(tree.length > 0 ? tree : ["- Tidak ada file yang cocok ditemukan."]),
      hiddenCount > 0 ? `\nMasih ada ${hiddenCount} file lain yang tidak ditampilkan agar pesan tidak terlalu panjang.` : "",
      "",
      "Catatan: folder runtime/rahasia seperti .git, node_modules, .next, dist, storage, .tools, dan coverage sengaja tidak dibaca."
    ]
      .filter(Boolean)
      .join("\n");
  }

  private relevantFiles(prompt: string, files: string[]) {
    const normalized = prompt.toLowerCase();
    const terms = normalized.split(/[^a-z0-9_/-]+/u).filter((term) => term.length >= 3);
    const explicitFiles = files.filter((file) => normalized.includes(basename(file).toLowerCase()));
    if (explicitFiles.length > 0) return explicitFiles.slice(0, 4);
    return files
      .map((file) => {
        const lower = file.toLowerCase();
        let score = 0;
        for (const term of terms) if (lower.includes(term)) score += 2;
        if (
          ["dokumen", "document", "dokumentasi", "prd", "readme"].some((term) => normalized.includes(term)) &&
          /\.(md|txt)$/i.test(file)
        ) {
          score += 8;
        }
        if (["prd", "readme"].some((name) => lower.includes(name))) score += 4;
        if (normalized.includes("web") && lower.startsWith("apps/web/")) score += 5;
        if (normalized.includes("dashboard") && lower.includes("dashboard")) score += 6;
        if (normalized.includes("setting") && lower.includes("settings")) score += 6;
        if (normalized.includes("style") && lower.endsWith(".css")) score += 4;
        if (["package.json", "apps/web/package.json", "apps/api/package.json"].includes(file)) score += 1;
        return { file, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file))
      .slice(0, 8)
      .map((item) => item.file);
  }

  private async workspaceContext(prompt: string, agent: { workspaceAccess: boolean; workspaceRoot: string | null }) {
    if (!agent.workspaceAccess) return undefined;
    const root = this.workspaceRoot(agent.workspaceRoot);
    const files = await this.workspaceFiles(root);
    const selectedFiles = this.relevantFiles(prompt, files);
    const snippets: string[] = [];
    let budget = 24000;
    for (const file of selectedFiles) {
      const absolute = resolve(root, file);
      const info = await stat(absolute);
      if (!info.isFile() || info.size > 200_000) continue;
      const content = (await readFile(absolute, "utf8")).slice(0, Math.min(6000, budget));
      budget -= content.length;
      snippets.push(`FILE: ${file}\n${content}`);
      if (budget <= 0) break;
    }
    const tree = files.slice(0, 120).join("\n");
    return [
      `Workspace root: ${relative(this.workspaceBase(), root) || "."}`,
      "Daftar file yang dapat dibaca:",
      tree,
      snippets.length ? "Cuplikan file relevan:" : "",
      snippets.join("\n\n---\n\n")
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private documentStudyFallback(agentName: string, context?: string) {
    if (!context) return undefined;
    const match = context.match(/FILE:\s*([^\n]+\.(?:md|txt))\n([\s\S]*?)(?=\n\n---\n\nFILE:|\n\n---\n\n|$)/iu);
    if (!match) return undefined;
    const fileName = match[1].trim();
    const content = match[2].trim();
    const headings = content
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => /^#{1,3}\s+/.test(line))
      .map((line) => line.replace(/^#{1,3}\s+/u, ""))
      .filter(Boolean)
      .slice(0, 8);
    const bullets = content
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+/.test(line))
      .map((line) => line.replace(/^[-*]\s+/u, ""))
      .filter(Boolean)
      .slice(0, 8);
    const summary = headings.length > 0 ? headings : bullets;
    return [
      `${agentName} sudah mempelajari dokumen ${fileName}.`,
      "",
      "Inti dokumen:",
      ...(summary.length > 0 ? summary.map((item) => `- ${item}`) : ["- Dokumen berhasil dibaca, tetapi ringkasan otomatis terbatas pada cuplikan awal file."]),
      "",
      "Kesimpulan awal: dokumen ini menjadi acuan kebutuhan dan arsitektur aplikasi Telegram Web Communication Hub berbasis Next.js, NestJS, Prisma, SQLite, dan Telegram Bot API."
    ].join("\n");
  }

  private workspaceFallback(agentName: string, context?: string) {
    if (!context) return undefined;
    const documentFallback = this.documentStudyFallback(agentName, context);
    if (documentFallback) return documentFallback;
    const snippetFiles = context
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("FILE: "))
      .map((line) => line.replace(/^FILE:\s*/u, ""));
    const treeFiles = context
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => !line.startsWith("FILE: "))
      .filter((line) => /\.(md|txt|tsx?|jsx?|css|json|prisma|sql)$/i.test(line))
      .sort((left, right) => {
        const leftDoc = /\.(md|txt)$/i.test(left) ? 0 : 1;
        const rightDoc = /\.(md|txt)$/i.test(right) ? 0 : 1;
        return leftDoc - rightDoc || left.localeCompare(right);
      });
    const files = [...new Set([...snippetFiles, ...treeFiles])].slice(0, 10);
    if (files.length === 0) return undefined;
    return [
      `${agentName} sudah mendapatkan konteks folder aplikasi, tetapi provider AI belum memberi jawaban final tepat waktu.`,
      "File yang relevan ditemukan:",
      ...files.map((file) => `- ${file}`),
      "Ulangi perintah dengan bagian dokumen atau bug yang ingin difokuskan."
    ].join("\n");
  }

  async list() {
    const agents = await this.prisma.aiAgent.findMany({ orderBy: { createdAt: "desc" } });
    return agents.map((agent) => this.safe(agent));
  }

  async create(dto: CreateAiAgentDto, actorUserId: string) {
    const encrypted = this.crypto.encrypt(dto.apiKey);
    const agent = await this.prisma.aiAgent.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        baseUrl: dto.baseUrl.replace(/\/+$/, ""),
        modelId: dto.modelId,
        apiKeyCiphertext: encrypted.tokenCiphertext,
        apiKeyIv: encrypted.tokenIv,
        apiKeyAuthTag: encrypted.tokenAuthTag,
        apiKeyLast4: encrypted.tokenLast4
      }
    });
    await this.audit.record({ actorUserId, action: "ai_agent.create", targetType: "AiAgent", targetId: agent.id });
    return this.safe(agent);
  }

  async update(id: string, dto: UpdateAiAgentDto, actorUserId: string) {
    const encrypted = dto.apiKey ? this.crypto.encrypt(dto.apiKey) : undefined;
    const agent = await this.prisma.aiAgent.update({
      where: { id },
      data: {
        name: dto.name,
        provider: dto.provider,
        baseUrl: dto.baseUrl?.replace(/\/+$/, ""),
        modelId: dto.modelId,
        isActive: dto.isActive,
        workspaceAccess: dto.workspaceAccess,
        workspaceRoot: dto.workspaceRoot,
        ...(encrypted
          ? {
              apiKeyCiphertext: encrypted.tokenCiphertext,
              apiKeyIv: encrypted.tokenIv,
              apiKeyAuthTag: encrypted.tokenAuthTag,
              apiKeyLast4: encrypted.tokenLast4
            }
          : {})
      }
    });
    await this.audit.record({ actorUserId, action: "ai_agent.update", targetType: "AiAgent", targetId: agent.id });
    return this.safe(agent);
  }

  async tokenFor(id: string) {
    const agent = await this.prisma.aiAgent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException({ code: "AI_AGENT_NOT_FOUND", message: "AI agent tidak ditemukan." });
    return {
      agent,
      apiKey: this.crypto.decrypt({
        tokenCiphertext: agent.apiKeyCiphertext,
        tokenIv: agent.apiKeyIv,
        tokenAuthTag: agent.apiKeyAuthTag
      })
    };
  }

  async test(id: string) {
    const { agent, apiKey } = await this.tokenFor(id);
    try {
      const response = await this.fetchWithTimeout(`${agent.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: agent.modelId,
          messages: [
            {
              role: "system",
              content:
                "Jawab singkat dalam bahasa Indonesia. Jangan tampilkan markup tool seperti <web_search>, <search>, <query>, atau <thinking>."
            },
            { role: "user", content: "Balas dengan kata: agent siap" }
          ],
          temperature: 0.2,
          max_tokens: 32
        })
      });
      const raw = await response.text();
      if (!response.ok) {
        throw new Error(this.providerError(raw, "AI agent test gagal"));
      }
      const content = this.completionContent(raw);
      const updated = await this.prisma.aiAgent.update({
        where: { id },
        data: { lastCheckedAt: new Date(), lastError: null }
      });
      return { ...this.safe(updated), sample: content };
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI agent test gagal";
      const updated = await this.prisma.aiAgent.update({
        where: { id },
        data: { lastCheckedAt: new Date(), lastError: message }
      });
      return { ...this.safe(updated), sample: null };
    }
  }

  async answer(prompt: string, agentName?: string, conversationContext: ConversationTurn[] = []) {
    const agent = agentName
        ? await this.prisma.aiAgent.findFirst({
            where: { name: agentName, isActive: true },
          orderBy: [{ workspaceAccess: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }]
          })
      : await this.prisma.aiAgent.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    const fallbackAgent =
      agent ?? (await this.prisma.aiAgent.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
    if (!fallbackAgent) return undefined;
    const selectedAgent = fallbackAgent;
    const netWatchAnswer = await this.netWatchWorkflowAnswer(selectedAgent.name, prompt, selectedAgent);
    if (netWatchAnswer) return netWatchAnswer;
    const folderCreationAnswer = await this.workspaceFolderCreationAnswer(selectedAgent.name, prompt, selectedAgent);
    if (folderCreationAnswer) return folderCreationAnswer;
    const listingAnswer = await this.workspaceListingAnswer(selectedAgent.name, prompt, selectedAgent, conversationContext);
    if (listingAnswer) return listingAnswer;
    const apiKey = this.crypto.decrypt({
      tokenCiphertext: selectedAgent.apiKeyCiphertext,
      tokenIv: selectedAgent.apiKeyIv,
      tokenAuthTag: selectedAgent.apiKeyAuthTag
    });
    let context: string | undefined;
    try {
      context = await this.workspaceContext(prompt, selectedAgent);
      const response = await this.fetchWithTimeout(`${selectedAgent.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: selectedAgent.modelId,
          messages: [
            {
              role: "system",
              content:
                "Jawab singkat, jelas, dan dalam bahasa Indonesia. Gunakan riwayat percakapan untuk memahami rujukan seperti 'nya', 'itu', 'yang tadi', atau 'sebelumnya'. Jangan tampilkan markup tool/XML seperti <web_search>, <search>, <query>, atau <thinking>. Jika perlu data real-time yang tidak tersedia, katakan bahwa data real-time belum tersedia dan minta user memberi data atau konteks. Jika konteks workspace tersedia, gunakan untuk menganalisis kode. Jangan mengaku sudah mengedit file; berikan saran patch atau langkah perubahan."
            },
            ...(context ? [{ role: "system", content: `Konteks workspace aplikasi:\n\n${context}` }] : []),
            ...conversationContext,
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 700
        })
      });
      const raw = await response.text();
      if (!response.ok) {
        throw new Error(this.providerError(raw, "AI agent gagal menjawab"));
      }
      const content = this.completionContent(raw);
      await this.prisma.aiAgent.update({ where: { id: selectedAgent.id }, data: { lastCheckedAt: new Date(), lastError: null } });
      return content || undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI agent gagal menjawab";
      await this.prisma.aiAgent.update({
        where: { id: selectedAgent.id },
        data: { lastCheckedAt: new Date(), lastError: message }
      });
      const fallback = this.workspaceFallback(selectedAgent.name, context);
      if (fallback) return fallback;
      return `Maaf, ${selectedAgent.name} belum bisa menjawab karena AI agent gagal diproses: ${message}`;
    }
  }
}
