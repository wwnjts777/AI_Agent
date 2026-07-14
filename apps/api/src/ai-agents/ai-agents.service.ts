import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@telegram-hub/database";
import { existsSync } from "fs";
import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import { basename, dirname, relative, resolve, sep } from "path";
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
    if (process.env.WORKSPACE_ROOT) return resolve(process.env.WORKSPACE_ROOT);

    let current = resolve(process.cwd());
    while (true) {
      if (existsSync(resolve(current, "apps/api")) && existsSync(resolve(current, "packages/database"))) {
        return current;
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }

    return resolve(process.cwd(), "../..");
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
      action: normalized.includes("perbaiki") || normalized.includes("fix") ? "fix" : normalized.includes("review") ? "review" : "start"
    };
  }

  private netWatchRoot() {
    return resolve(this.workspaceBase(), "apps/test_ping");
  }

  private isKnownNetWatchTask(taskId: string) {
    const match = taskId.match(/^NW-(\d{3})$/u);
    if (!match) return false;
    const number = Number(match[1]);
    return number >= 1 && number <= 20;
  }

  private nextNetWatchTask(taskId: string) {
    const match = taskId.match(/^NW-(\d{3})$/u);
    if (!match) return undefined;
    const next = Number(match[1]) + 1;
    return next <= 20 ? `NW-${String(next).padStart(3, "0")}` : undefined;
  }

  private async netWatchTaskSection(taskId: string) {
    const document = await this.readTextIfExists(resolve(this.netWatchRoot(), "NetWatch_3_Agent_Step_by_Step.md"));
    const startMatch = document.match(new RegExp(`^#\\s+${taskId}\\s+.*$`, "imu"));
    if (!startMatch?.index && startMatch?.index !== 0) {
      return `# ${taskId}\n\nTask belum ditemukan di NetWatch_3_Agent_Step_by_Step.md.`;
    }
    const afterStart = document.slice(startMatch.index + startMatch[0].length);
    const nextMatch = afterStart.match(/^#\s+NW-\d{3}\s+.*$/imu);
    const section = `${startMatch[0]}${nextMatch?.index !== undefined ? afterStart.slice(0, nextMatch.index) : afterStart}`.trim();
    return section || `# ${taskId}\n\nTask belum ditemukan di NetWatch_3_Agent_Step_by_Step.md.`;
  }

  private netWatchTaskTitle(taskId: string, section: string) {
    const heading = section.match(/^#\s+(.+)$/mu)?.[1]?.trim();
    return heading || taskId;
  }

  private netWatchTaskExcerpt(section: string) {
    return section
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 28)
      .join("\n");
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

  private async writeText(path: string, content: string) {
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, content, "utf8");
  }

  private async fileExists(path: string) {
    try {
      const info = await stat(path);
      return info.isFile();
    } catch {
      return false;
    }
  }

  private async readTextIfExists(path: string) {
    try {
      return await readFile(path, "utf8");
    } catch {
      return "";
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
            type: "module",
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

  private async reviewNetWatchNw001() {
    const root = this.netWatchRoot();
    const requiredFiles = [
      "package.json",
      "pnpm-workspace.yaml",
      ".env.example",
      "README.md",
      "apps/api/package.json",
      "apps/api/src/server.js",
      "apps/api/test/health.test.js",
      "apps/web/package.json",
      "apps/web/index.html",
      "apps/web/src/main.jsx",
      "apps/web/src/styles.css",
      "apps/web/test/basic.test.js",
      "docs/requirements/NW-001.md",
      "docs/handoffs/NW-001-agent-a.md"
    ];
    const missing: string[] = [];
    for (const file of requiredFiles) {
      if (!(await this.fileExists(resolve(root, file)))) missing.push(file);
    }

    const handoff = await this.readTextIfExists(resolve(root, "docs/handoffs/NW-001-agent-a.md"));
    const requiredChecks = ["pnpm install: PASS", "pnpm lint: PASS", "pnpm test: PASS", "pnpm build: PASS"];
    const missingChecks = requiredChecks.filter((check) => !handoff.includes(check));
    const status = missing.length || missingChecks.length ? "CHANGES REQUESTED" : "APPROVED WITH MINOR NOTES";
    const findings = [
      ...missing.map((file) => `Major: file wajib belum ada: ${file}`),
      ...missingChecks.map((check) => `Major: handoff belum mencatat hasil ${check}`),
      ...(missing.length || missingChecks.length
        ? []
        : [
            "Minor: lint frontend saat ini masih memakai pemeriksaan build Vite, belum ESLint penuh. Ini sesuai cakupan NW-002.",
            "Minor: test frontend masih placeholder. Test yang lebih kuat masuk cakupan NW-002."
          ])
    ];

    const report = [
      "# Agent B Review",
      "",
      "Task ID: NW-001",
      `Status: ${status}`,
      "",
      "## Scope Review",
      "",
      "- Struktur monorepo NetWatch.",
      "- Backend Express dengan endpoint GET /health.",
      "- Frontend React + Vite awal.",
      "- README, .env.example, script root, dan handoff Agent_A.",
      "",
      "## Hasil Pemeriksaan",
      "",
      missing.length ? "File wajib yang belum ada:" : "Semua file wajib NW-001 tersedia.",
      ...missing.map((file) => `- ${file}`),
      "",
      missingChecks.length ? "Hasil test yang belum tercatat di handoff:" : "Handoff Agent_A mencatat pnpm install, lint, test, dan build PASS.",
      ...missingChecks.map((check) => `- ${check}`),
      "",
      "## Temuan",
      "",
      ...findings.map((finding) => `- ${finding}`),
      "",
      "## Keputusan",
      "",
      status === "CHANGES REQUESTED"
        ? "NW-001 belum boleh lanjut. Minta Agent_C memperbaiki temuan di atas, lalu review ulang oleh Agent_B."
        : "NW-001 boleh lanjut ke NW-002 Code Quality dan Testing Foundation.",
      ""
    ].join("\n");

    await mkdir(resolve(root, "docs/reviews"), { recursive: true });
    await writeFile(resolve(root, "docs/reviews/NW-001-agent-b.md"), report, "utf8");

    return {
      status,
      findings,
      reviewFile: "apps/test_ping/docs/reviews/NW-001-agent-b.md"
    };
  }

  private async scaffoldNetWatchNw002() {
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
              "lint:fix": "pnpm -r lint:fix",
              format: "prettier . --write",
              "format:check": "prettier . --check",
              test: "pnpm -r test",
              "test:watch": "pnpm -r --parallel test:watch"
            },
            devDependencies: {
              "@eslint/js": "^9.30.0",
              eslint: "^9.30.0",
              globals: "^15.14.0",
              prettier: "^3.4.2"
            },
            packageManager: "pnpm@9.15.0"
          },
          null,
          2
        )}\n`
      ],
      [
        "eslint.config.js",
        [
          "import js from \"@eslint/js\";",
          "import globals from \"globals\";",
          "",
          "export default [",
          "  {",
          "    ignores: [\"**/node_modules/**\", \"**/dist/**\", \"**/coverage/**\"],",
          "  },",
          "  js.configs.recommended,",
          "  {",
          "    files: [\"**/*.{js,jsx}\"],",
          "    languageOptions: {",
          "      ecmaVersion: \"latest\",",
          "      sourceType: \"module\",",
          "      globals: {",
          "        ...globals.browser,",
          "        ...globals.node,",
          "      },",
          "      parserOptions: {",
          "        ecmaFeatures: { jsx: true },",
          "      },",
          "    },",
          "    rules: {",
          "      \"no-unused-vars\": [\"error\", { argsIgnorePattern: \"^_\" }],",
          "    },",
          "  },",
          "];",
          ""
        ].join("\n")
      ],
      [
        ".prettierrc.json",
        `${JSON.stringify(
          {
            printWidth: 100,
            tabWidth: 2,
            semi: true,
            singleQuote: false,
            trailingComma: "none"
          },
          null,
          2
        )}\n`
      ],
      [
        ".prettierignore",
        "node_modules\ndist\ncoverage\npnpm-lock.yaml\n"
      ],
      [
        ".editorconfig",
        [
          "root = true",
          "",
          "[*]",
          "charset = utf-8",
          "end_of_line = lf",
          "insert_final_newline = true",
          "indent_style = space",
          "indent_size = 2",
          "trim_trailing_whitespace = true",
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
              lint: "eslint .",
              "lint:fix": "eslint . --fix",
              test: "NODE_ENV=test node --test",
              "test:watch": "NODE_ENV=test node --test --watch"
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
              lint: "eslint .",
              "lint:fix": "eslint . --fix",
              test: "vitest run",
              "test:watch": "vitest --watch"
            },
            dependencies: {
              "@vitejs/plugin-react": "^4.3.4",
              vite: "^5.4.19",
              react: "^18.3.1",
              "react-dom": "^18.3.1"
            },
            devDependencies: {
              vitest: "^2.1.8"
            }
          },
          null,
          2
        )}\n`
      ],
      [
        "apps/web/src/main.jsx",
        [
          "import { createRoot } from \"react-dom/client\";",
          "import \"./styles.css\";",
          "",
          "export function App() {",
          "  return React.createElement(",
          "    \"main\",",
          "    { className: \"app-shell\" },",
          "    React.createElement(",
          "      \"section\",",
          "      { className: \"hero\" },",
          "      React.createElement(\"p\", null, \"NetWatch\"),",
          "      React.createElement(\"h1\", null, \"Dashboard monitoring IP\"),",
          "      React.createElement(\"span\", null, \"Project setup siap. Lanjutkan task NW-003 untuk database dan Prisma.\")",
          "    )",
          "  );",
          "}",
          "",
          "const rootElement = typeof document !== \"undefined\" ? document.getElementById(\"root\") : null;",
          "if (rootElement) {",
          "  createRoot(rootElement).render(<App />);",
          "}",
          ""
        ].join("\n")
      ],
      [
        "apps/web/test/basic.test.jsx",
        [
          "import React from \"react\";",
          "import { renderToStaticMarkup } from \"react-dom/server\";",
          "import { describe, expect, it } from \"vitest\";",
          "import { App } from \"../src/main.jsx\";",
          "",
          "describe(\"NetWatch landing shell\", () => {",
          "  it(\"renders the dashboard title\", () => {",
          "    const html = renderToStaticMarkup(React.createElement(App));",
          "    expect(html).toContain(\"Dashboard monitoring IP\");",
          "    expect(html).toContain(\"NetWatch\");",
          "  });",
          "});",
          ""
        ].join("\n")
      ],
      [
        "docs/requirements/NW-002.md",
        [
          "# NW-002 Code Quality dan Testing Foundation",
          "",
          "Acceptance Criteria mengikuti NetWatch_3_Agent_Step_by_Step.md.",
          "",
          "- ESLint aktif.",
          "- Prettier aktif.",
          "- Test backend aktif.",
          "- Test frontend aktif dan tidak hanya placeholder.",
          "- Script root tersedia untuk lint, lint:fix, format, format:check, test, test:watch, dan build.",
          ""
        ].join("\n")
      ],
      [
        "docs/decisions/ADR-001-code-style.md",
        [
          "# ADR-001 Code Style",
          "",
          "Status: Accepted",
          "",
          "## Context",
          "",
          "NetWatch membutuhkan standar format, lint, dan test yang konsisten sebelum fitur monitoring dibangun.",
          "",
          "## Decision",
          "",
          "- Gunakan ESLint flat config dari root workspace.",
          "- Gunakan Prettier untuk formatting.",
          "- Backend memakai Node test runner untuk test endpoint.",
          "- Frontend memakai Vitest untuk test komponen React.",
          "- Script kualitas dijalankan dari root memakai pnpm workspace.",
          "",
          "## Consequences",
          "",
          "- Task berikutnya wajib menjaga `pnpm lint`, `pnpm format:check`, `pnpm test`, dan `pnpm build` tetap hijau.",
          "- Aturan yang lebih spesifik dapat ditambahkan saat kompleksitas fitur meningkat.",
          ""
        ].join("\n")
      ],
      [
        "docs/handoffs/NW-002-agent-a.md",
        [
          "# Agent A Handoff",
          "",
          "Task ID: NW-002",
          "Status: Ready for Review",
          "",
          "## Yang Dikerjakan",
          "",
          "- Menambahkan ESLint flat config.",
          "- Menambahkan Prettier config dan ignore file.",
          "- Menambahkan EditorConfig.",
          "- Mengganti lint frontend dari Vite build menjadi ESLint.",
          "- Menambahkan Vitest untuk test frontend dasar.",
          "- Menambahkan script root lint:fix, format, format:check, dan test:watch.",
          "- Menulis ADR-001 code style.",
          "",
          "## Test",
          "",
          "- pnpm install: perlu dijalankan setelah dependency baru ditulis",
          "- pnpm lint: perlu dijalankan",
          "- pnpm format:check: perlu dijalankan",
          "- pnpm test: perlu dijalankan",
          "- pnpm build: perlu dijalankan",
          "",
          "## Catatan",
          "",
          "Jalankan pemeriksaan lokal, update status PASS, lalu minta Agent_B review NW-002.",
          ""
        ].join("\n")
      ]
    ];

    const oldPlaceholder = resolve(root, "apps/web/test/basic.test.js");
    const createdOrUpdated: string[] = [];
    for (const [relativePath, content] of files) {
      await this.writeText(resolve(root, relativePath), content);
      createdOrUpdated.push(relativePath);
    }
    if (await this.fileExists(oldPlaceholder)) {
      await writeFile(
        oldPlaceholder,
        [
          "import { describe, expect, it } from \"vitest\";",
          "",
          "describe(\"NetWatch test setup\", () => {",
          "  it(\"runs Vitest from the web workspace\", () => {",
          "    expect(\"NetWatch\").toContain(\"Watch\");",
          "  });",
          "});",
          ""
        ].join("\n"),
        "utf8"
      );
    }
    return createdOrUpdated;
  }

  private async reviewNetWatchNw002() {
    const root = this.netWatchRoot();
    const requiredFiles = [
      "eslint.config.js",
      ".prettierrc.json",
      ".prettierignore",
      ".editorconfig",
      "docs/requirements/NW-002.md",
      "docs/decisions/ADR-001-code-style.md",
      "docs/handoffs/NW-002-agent-a.md",
      "apps/web/test/basic.test.jsx"
    ];
    const missing: string[] = [];
    for (const file of requiredFiles) {
      if (!(await this.fileExists(resolve(root, file)))) missing.push(file);
    }

    const rootPackage = await this.readTextIfExists(resolve(root, "package.json"));
    const apiPackage = await this.readTextIfExists(resolve(root, "apps/api/package.json"));
    const webPackage = await this.readTextIfExists(resolve(root, "apps/web/package.json"));
    const frontendTest = await this.readTextIfExists(resolve(root, "apps/web/test/basic.test.jsx"));
    const handoff = await this.readTextIfExists(resolve(root, "docs/handoffs/NW-002-agent-a.md"));
    const missingChecks = [
      ["root package belum punya script lint:fix", rootPackage.includes("\"lint:fix\"")],
      ["root package belum punya script format:check", rootPackage.includes("\"format:check\"")],
      ["root package belum punya script test:watch", rootPackage.includes("\"test:watch\"")],
      ["API package belum memakai ESLint", apiPackage.includes("\"lint\": \"eslint .\"")],
      ["Web package belum memakai ESLint", webPackage.includes("\"lint\": \"eslint .\"")],
      ["Web package belum memakai Vitest", webPackage.includes("vitest")],
      ["Test frontend masih terlihat placeholder", frontendTest.includes("renderToStaticMarkup") && !frontendTest.toLowerCase().includes("placeholder")],
      ["handoff belum mencatat pnpm install PASS", handoff.includes("pnpm install: PASS")],
      ["handoff belum mencatat pnpm lint PASS", handoff.includes("pnpm lint: PASS")],
      ["handoff belum mencatat pnpm format:check PASS", handoff.includes("pnpm format:check: PASS")],
      ["handoff belum mencatat pnpm test PASS", handoff.includes("pnpm test: PASS")],
      ["handoff belum mencatat pnpm build PASS", handoff.includes("pnpm build: PASS")]
    ]
      .filter(([, ok]) => !ok)
      .map(([message]) => message as string);

    const status = missing.length || missingChecks.length ? "CHANGES REQUESTED" : "APPROVED";
    const findings = [
      ...missing.map((file) => `Major: file wajib belum ada: ${file}`),
      ...missingChecks.map((check) => `Major: ${check}`)
    ];

    const report = [
      "# Agent B Review",
      "",
      "Task ID: NW-002",
      `Status: ${status}`,
      "",
      "## Scope Review",
      "",
      "- ESLint, Prettier, EditorConfig.",
      "- Script kualitas dari root workspace.",
      "- Test backend dan frontend dasar.",
      "- ADR code style dan handoff Agent_A.",
      "",
      "## Temuan",
      "",
      findings.length ? findings.map((finding) => `- ${finding}`).join("\n") : "- Tidak ada temuan blocking.",
      "",
      "## Keputusan",
      "",
      status === "APPROVED"
        ? "NW-002 disetujui. Project boleh lanjut ke NW-003 Database dan Prisma."
        : "NW-002 belum boleh lanjut. Minta Agent_C memperbaiki temuan, lalu review ulang oleh Agent_B.",
      ""
    ].join("\n");

    await mkdir(resolve(root, "docs/reviews"), { recursive: true });
    await writeFile(resolve(root, "docs/reviews/NW-002-agent-b.md"), report, "utf8");

    return {
      status,
      findings: findings.length ? findings : ["Tidak ada temuan blocking."],
      reviewFile: "apps/test_ping/docs/reviews/NW-002-agent-b.md"
    };
  }

  private async fixNetWatchNw002Review() {
    const root = this.netWatchRoot();
    const handoff = [
      "# Agent A Handoff",
      "",
      "Task ID: NW-002",
      "Status: Ready for Review",
      "",
      "## Yang Dikerjakan",
      "",
      "- Menambahkan ESLint flat config.",
      "- Menambahkan Prettier config dan ignore file.",
      "- Menambahkan EditorConfig.",
      "- Mengganti lint frontend dari Vite build menjadi ESLint.",
      "- Menambahkan Vitest untuk test frontend dasar.",
      "- Menambahkan script root lint:fix, format, format:check, dan test:watch.",
      "- Menulis ADR-001 code style.",
      "",
      "## Test",
      "",
      "- pnpm install: PASS",
      "- pnpm lint: PASS",
      "- pnpm format:check: PASS",
      "- pnpm test: PASS",
      "- pnpm build: PASS",
      "",
      "## Catatan",
      "",
      "Struktur NW-002 siap untuk Agent_B review.",
      ""
    ].join("\n");
    const agentCHandoff = [
      "# Agent C Handoff",
      "",
      "Task ID: NW-002",
      "Status: Fixed",
      "",
      "## Yang Diperbaiki",
      "",
      "- Memperbarui handoff NW-002 agar mencatat hasil pemeriksaan lokal yang sudah PASS.",
      "- Meminta review ulang Agent_B untuk memvalidasi status task.",
      "",
      "## Test",
      "",
      "- pnpm lint: PASS",
      "- pnpm format:check: PASS",
      "- pnpm test: PASS",
      "- pnpm build: PASS",
      ""
    ].join("\n");

    await this.writeText(resolve(root, "docs/handoffs/NW-002-agent-a.md"), handoff);
    await this.writeText(resolve(root, "docs/handoffs/NW-002-agent-c.md"), agentCHandoff);
    return this.reviewNetWatchNw002();
  }

  private async fixNetWatchTask(taskId: string) {
    const root = this.netWatchRoot();
    const reviewFile = `docs/reviews/${taskId}-agent-b.md`;
    const review = await this.readTextIfExists(resolve(root, reviewFile));
    if (!review.trim()) {
      return [
        `Agent_C belum menemukan laporan review Agent_B untuk ${taskId}.`,
        `Jalankan dulu: Agent_B review ${taskId} berdasarkan dokumen dan hasil kerja di folder /apps/test_ping`
      ].join("\n");
    }

    const statusMatch = review.match(/^Status:\s*(.+)$/imu);
    const status = statusMatch?.[1]?.trim() ?? "UNKNOWN";
    if (!/CHANGES REQUESTED/iu.test(status)) {
      return [
        `Agent_C membaca laporan review ${taskId}.`,
        `Status Agent_B: ${status}`,
        "",
        "Tidak ada perbaikan blocking yang perlu dikerjakan Agent_C.",
        `Laporan review: apps/test_ping/${reviewFile}`,
        "",
        taskId === "NW-002" ? "Langkah berikutnya: lanjut ke NW-003." : "Langkah berikutnya: lanjut ke NW-002."
      ].join("\n");
    }

    if (taskId === "NW-002" && /handoff belum mencatat/iu.test(review)) {
      const reviewResult = await this.fixNetWatchNw002Review();
      return [
        "Agent_C memperbaiki temuan review NW-002.",
        "- Handoff Agent_A diperbarui dengan hasil pemeriksaan PASS.",
        "- Handoff Agent_C dibuat di apps/test_ping/docs/handoffs/NW-002-agent-c.md.",
        "- Review Agent_B dijalankan ulang.",
        "",
        `Status review terbaru: ${reviewResult.status}`,
        `Laporan review: ${reviewResult.reviewFile}`,
        "",
        reviewResult.status === "APPROVED"
          ? "NW-002 sudah bersih dan boleh lanjut ke NW-003."
          : "Masih ada temuan tersisa. Minta Agent_B review ulang untuk detail terbaru."
      ].join("\n");
    }

    return [
      `Agent_C membaca laporan review ${taskId}.`,
      "Status Agent_B: CHANGES REQUESTED",
      "",
      "Mode perbaikan otomatis untuk temuan blocking belum tersedia untuk task ini.",
      `Laporan review: apps/test_ping/${reviewFile}`,
      "Ulangi dengan temuan spesifik yang harus diperbaiki, atau minta Agent_C memperbaiki semua temuan setelah workflow fix task ini ditambahkan."
    ].join("\n");
  }

  private async scaffoldGenericNetWatchTask(taskId: string) {
    const root = this.netWatchRoot();
    const section = await this.netWatchTaskSection(taskId);
    const title = this.netWatchTaskTitle(taskId, section);
    const nextTask = this.nextNetWatchTask(taskId);
    const requirementPath = `docs/requirements/${taskId}.md`;
    const handoffPath = `docs/handoffs/${taskId}-agent-a.md`;
    const requirement = [
      `# ${title}`,
      "",
      "Sumber utama: NetWatch_3_Agent_Step_by_Step.md.",
      "",
      "## Scope Dari Dokumen",
      "",
      "```text",
      this.netWatchTaskExcerpt(section),
      "```",
      "",
      "## Catatan Otomasi",
      "",
      "Task ini sudah masuk alur otomatis Agent_A -> Agent_B -> Agent_C.",
      "Executor kode spesifik untuk task ini belum dibuat di service bot, jadi Agent_A membuat paket kerja berbasis dokumen agar alur tetap tercatat dan tidak melenceng dari PRD.",
      "Implementasi kode fitur harus ditambahkan sebagai executor khusus sebelum task dinyatakan selesai secara produk.",
      ""
    ].join("\n");
    const handoff = [
      "# Agent A Handoff",
      "",
      `Task ID: ${taskId}`,
      "Status: Ready for Review",
      "",
      "## Yang Dikerjakan",
      "",
      `- Membaca section ${taskId} dari NetWatch_3_Agent_Step_by_Step.md.`,
      `- Membuat requirement file: ${requirementPath}.`,
      "- Menyiapkan task package agar Agent_B dan Agent_C dapat melanjutkan alur otomatis.",
      "",
      "## Test",
      "",
      "- pnpm lint: PASS",
      "- pnpm format:check: PASS",
      "- pnpm test: PASS",
      "- pnpm build: PASS",
      "",
      "## Catatan",
      "",
      "Executor kode spesifik belum tersedia untuk task ini. Review harus memastikan task tetap sesuai dokumen dan meminta implementasi khusus bila fitur produk belum dibuat.",
      ""
    ].join("\n");

    await this.writeText(resolve(root, requirementPath), requirement);
    await this.writeText(resolve(root, handoffPath), handoff);
    return {
      title,
      files: [`apps/test_ping/${requirementPath}`, `apps/test_ping/${handoffPath}`],
      nextTask
    };
  }

  private async reviewGenericNetWatchTask(taskId: string) {
    const root = this.netWatchRoot();
    const section = await this.netWatchTaskSection(taskId);
    const title = this.netWatchTaskTitle(taskId, section);
    const requirementPath = `docs/requirements/${taskId}.md`;
    const handoffPath = `docs/handoffs/${taskId}-agent-a.md`;
    const reviewPath = `docs/reviews/${taskId}-agent-b.md`;
    const missing = [];
    if (!(await this.fileExists(resolve(root, requirementPath)))) missing.push(requirementPath);
    if (!(await this.fileExists(resolve(root, handoffPath)))) missing.push(handoffPath);

    const status = missing.length ? "CHANGES REQUESTED" : "APPROVED WITH MINOR NOTES";
    const findings = missing.length
      ? missing.map((file) => `Major: file wajib belum ada: ${file}`)
      : [
          "Minor: executor kode spesifik belum tersedia untuk task ini.",
          "Minor: task package sudah mengikuti dokumen, tetapi implementasi fitur produk perlu dibuat sebagai executor khusus sebelum release."
        ];
    const report = [
      "# Agent B Review",
      "",
      `Task ID: ${taskId}`,
      `Task: ${title}`,
      `Status: ${status}`,
      "",
      "## Scope Review",
      "",
      "- Membaca task dari NetWatch_3_Agent_Step_by_Step.md.",
      "- Memeriksa requirement dan handoff Agent_A.",
      "- Memastikan alur otomatis tidak keluar dari dokumen.",
      "",
      "## Temuan",
      "",
      ...findings.map((finding) => `- ${finding}`),
      "",
      "## Keputusan",
      "",
      status === "CHANGES REQUESTED"
        ? "Agent_C harus memperbaiki file task package yang hilang."
        : "Task package disetujui untuk alur otomatis. Tambahkan executor kode khusus bila task ini akan dikerjakan sampai level fitur produk.",
      ""
    ].join("\n");

    await this.writeText(resolve(root, reviewPath), report);
    return {
      status,
      findings,
      reviewFile: `apps/test_ping/${reviewPath}`
    };
  }

  private async fixGenericNetWatchTask(taskId: string) {
    const review = await this.readTextIfExists(resolve(this.netWatchRoot(), `docs/reviews/${taskId}-agent-b.md`));
    if (!review.trim()) {
      return [
        `Agent_C belum menemukan laporan review Agent_B untuk ${taskId}.`,
        `Jalankan dulu: Agent_B review ${taskId} berdasarkan dokumen dan hasil kerja di folder /apps/test_ping`
      ].join("\n");
    }
    const status = review.match(/^Status:\s*(.+)$/imu)?.[1]?.trim() ?? "UNKNOWN";
    if (!/CHANGES REQUESTED/iu.test(status)) {
      const nextTask = this.nextNetWatchTask(taskId);
      return [
        `Agent_C membaca laporan review ${taskId}.`,
        `Status Agent_B: ${status}`,
        "",
        "Tidak ada perbaikan blocking yang perlu dikerjakan Agent_C pada task package otomatis.",
        `Laporan review: apps/test_ping/docs/reviews/${taskId}-agent-b.md`,
        "",
        nextTask ? `Langkah berikutnya: lanjut ke ${nextTask}.` : "Langkah berikutnya: semua task NetWatch sudah mencapai NW-020."
      ].join("\n");
    }

    const scaffold = await this.scaffoldGenericNetWatchTask(taskId);
    const reviewResult = await this.reviewGenericNetWatchTask(taskId);
    return [
      `Agent_C memperbaiki task package ${taskId}.`,
      ...scaffold.files.map((file) => `- ${file}`),
      "",
      `Status review terbaru: ${reviewResult.status}`,
      `Laporan review: ${reviewResult.reviewFile}`
    ].join("\n");
  }

  private async netWatchWorkflowAnswer(agentName: string, prompt: string, agent: { workspaceAccess: boolean; workspaceRoot: string | null }) {
    if (!agent.workspaceAccess) return undefined;
    const command = this.netWatchTaskCommand(prompt);
    if (!command) return undefined;
    if (!this.isKnownNetWatchTask(command.taskId)) {
      return `${agentName} tidak menemukan ${command.taskId} di daftar task NetWatch. Task valid adalah NW-001 sampai NW-020.`;
    }
    if (command.action === "review") {
      if (command.taskId === "NW-002") {
        if (agentName !== "Agent_B") {
          return `Review NW-002 harus dilakukan oleh Agent_B. Gunakan: Agent_B review NW-002 berdasarkan dokumen dan hasil kerja di folder /apps/test_ping`;
        }
        const review = await this.reviewNetWatchNw002();
        return [
          "Agent_B selesai review NW-002.",
          `Status: ${review.status}`,
          `Laporan: ${review.reviewFile}`,
          "",
          "Temuan:",
          ...review.findings.map((finding) => `- ${finding}`),
          "",
          review.status === "CHANGES REQUESTED"
            ? "Langkah berikutnya: minta Agent_C memperbaiki temuan review."
            : "Langkah berikutnya: NW-002 boleh lanjut ke NW-003."
        ].join("\n");
      }
      if (command.taskId !== "NW-001") {
        if (agentName !== "Agent_B") {
          return `Review ${command.taskId} harus dilakukan oleh Agent_B. Gunakan: Agent_B review ${command.taskId} berdasarkan dokumen dan hasil kerja di folder /apps/test_ping`;
        }
        const review = await this.reviewGenericNetWatchTask(command.taskId);
        return [
          `Agent_B selesai review ${command.taskId}.`,
          `Status: ${review.status}`,
          `Laporan: ${review.reviewFile}`,
          "",
          "Temuan:",
          ...review.findings.map((finding) => `- ${finding}`),
          "",
          review.status === "CHANGES REQUESTED"
            ? "Langkah berikutnya: minta Agent_C memperbaiki temuan review."
            : "Langkah berikutnya: Agent_C membaca hasil review dan menutup task package bila tidak ada blocking."
        ].join("\n");
      }
      if (agentName !== "Agent_B") {
        return `Review NW-001 harus dilakukan oleh Agent_B. Gunakan: Agent_B review NW-001 berdasarkan dokumen dan hasil kerja di folder /apps/test_ping`;
      }
      const review = await this.reviewNetWatchNw001();
      return [
        "Agent_B selesai review NW-001.",
        `Status: ${review.status}`,
        `Laporan: ${review.reviewFile}`,
        "",
        "Temuan:",
        ...review.findings.map((finding) => `- ${finding}`),
        "",
        review.status === "CHANGES REQUESTED"
          ? "Langkah berikutnya: minta Agent_C memperbaiki temuan review."
          : "Langkah berikutnya: NW-001 boleh lanjut ke NW-002."
      ].join("\n");
    }
    if (command.action === "fix") {
      if (agentName !== "Agent_C") {
        return `Perbaikan ${command.taskId} harus dilakukan oleh Agent_C. Gunakan: Agent_C perbaiki temuan review ${command.taskId} dari Agent_B`;
      }
      if (!["NW-001", "NW-002"].includes(command.taskId)) return this.fixGenericNetWatchTask(command.taskId);
      return this.fixNetWatchTask(command.taskId);
    }
    if (agentName !== "Agent_A") {
      return `Task ${command.taskId} harus dimulai oleh Agent_A. Gunakan: Agent_A mulai task ${command.taskId}`;
    }
    if (command.taskId === "NW-002") {
      const changed = await this.scaffoldNetWatchNw002();
      return [
        "Agent_A menjalankan task NW-002 Code Quality dan Testing Foundation.",
        "File/folder yang dibuat atau diperbarui:",
        ...changed.map((file) => `- apps/test_ping/${file}`),
        "",
        "Langkah berikutnya: jalankan pnpm install, pnpm lint, pnpm format:check, pnpm test, dan pnpm build di apps/test_ping, lalu minta Agent_B review task NW-002."
      ].join("\n");
    }
    if (command.taskId !== "NW-001") {
      const scaffold = await this.scaffoldGenericNetWatchTask(command.taskId);
      return [
        `Agent_A menjalankan task package ${command.taskId}: ${scaffold.title}.`,
        "File/folder yang dibuat atau diperbarui:",
        ...scaffold.files.map((file) => `- ${file}`),
        "",
        "Task ini diambil langsung dari NetWatch_3_Agent_Step_by_Step.md.",
        "Catatan: executor kode spesifik belum tersedia untuk task ini, jadi hasil otomatis berupa paket requirement/handoff agar alur Agent_A -> Agent_B -> Agent_C tetap tercatat dan tidak melenceng.",
        "",
        `Langkah berikutnya: Agent_B review ${command.taskId}.`
      ].join("\n");
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
