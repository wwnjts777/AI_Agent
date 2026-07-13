import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "@telegram-hub/database";
import { TelegramService } from "./telegram.service";

@Injectable()
export class TelegramPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramPollingService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    const enabled = process.env.TELEGRAM_POLLING_ENABLED ?? (process.env.NODE_ENV === "production" ? "false" : "true");
    if (enabled !== "true") return;

    const intervalMs = Number(process.env.TELEGRAM_POLLING_INTERVAL_MS ?? 5000);
    this.timer = setInterval(() => void this.poll(), intervalMs);
    void this.poll();
    this.logger.log(`Telegram polling enabled every ${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll() {
    if (this.running) return;
    this.running = true;
    try {
      const bots = await this.prisma.bot.findMany({ where: { isActive: true }, select: { id: true } });
      for (const bot of bots) {
        try {
          await this.telegram.syncUpdates(bot.id);
        } catch (error) {
          this.logger.warn(`Polling failed for bot ${bot.id}: ${error instanceof Error ? error.message : "unknown error"}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
