import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@telegram-hub/database";
import { readdir, readFile, stat } from "fs/promises";
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
    const entries = await readdir(current, { withFileTypes: true });
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

  private folderListingRequest(prompt: string) {
    const normalized = prompt.toLowerCase();
    return (
      /(sebutkan|tampilkan|lihatkan|list|daftar).*(isi|file|folder|struktur|workspace|direktori)/iu.test(normalized) ||
      /(isi|file|folder|struktur|workspace|direktori).*(aplikasi|project|proyek|workspace)/iu.test(normalized)
    );
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
      const normalized = raw.replace(/^\/+/u, "");
      if (normalized && !normalized.includes("..")) return normalized;
    }
    return undefined;
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

  private async workspaceListingAnswer(agentName: string, prompt: string, agent: { workspaceAccess: boolean; workspaceRoot: string | null }) {
    if (!agent.workspaceAccess || !this.folderListingRequest(prompt)) return undefined;
    const baseRoot = this.workspaceRoot(agent.workspaceRoot);
    const requestedPath = this.requestedWorkspacePath(prompt);
    const root = requestedPath ? this.workspaceRoot(requestedPath) : baseRoot;
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
    const listingAnswer = await this.workspaceListingAnswer(selectedAgent.name, prompt, selectedAgent);
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
