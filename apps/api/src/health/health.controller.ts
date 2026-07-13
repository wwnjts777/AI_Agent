import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "@telegram-hub/database";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("live")
  live() {
    return { status: "ok", uptime: process.uptime() };
  }

  @Get("ready")
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ready", database: "ok" };
  }

  @Get("bot")
  async bot() {
    const active = await this.prisma.bot.count({ where: { isActive: true } });
    return { status: active > 0 ? "configured" : "not_configured", activeBots: active };
  }
}
