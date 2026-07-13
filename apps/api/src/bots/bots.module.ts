import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EventsModule } from "../events/events.module";
import { BotsController } from "./bots.controller";
import { BotsService } from "./bots.service";
import { TelegramHttpService } from "./telegram-http.service";
import { TokenCryptoService } from "./token-crypto.service";

@Module({
  imports: [AuditModule, EventsModule],
  controllers: [BotsController],
  providers: [BotsService, TokenCryptoService, TelegramHttpService],
  exports: [BotsService, TokenCryptoService, TelegramHttpService]
})
export class BotsModule {}
