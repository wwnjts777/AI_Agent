import { Body, Controller, ForbiddenException, Headers, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../common/auth.guard";
import { TelegramService } from "./telegram.service";
import { TelegramUpdate } from "./telegram.types";

@Controller("webhooks/telegram")
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post(":botId")
  @HttpCode(200)
  async webhook(
    @Param("botId") botId: string,
    @Headers("x-telegram-bot-api-secret-token") secret: string | undefined,
    @Body() body: TelegramUpdate
  ) {
    if (!(await this.telegram.verifySecret(botId, secret))) {
      throw new ForbiddenException({ code: "WEBHOOK_SECRET_INVALID", message: "Secret webhook salah." });
    }
    await this.telegram.handleUpdate(botId, body);
    return { __raw: true, payload: { ok: true } };
  }

  @Post(":botId/sync")
  @UseGuards(AuthGuard)
  async sync(@Param("botId") botId: string) {
    return this.telegram.syncUpdates(botId);
  }
}
