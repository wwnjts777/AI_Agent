import { Module } from "@nestjs/common";
import { BotsModule } from "../bots/bots.module";
import { ChatsModule } from "../chats/chats.module";
import { MessagesModule } from "../messages/messages.module";
import { TelegramController } from "./telegram.controller";
import { TelegramPollingService } from "./telegram-polling.service";
import { TelegramService } from "./telegram.service";

@Module({
  imports: [BotsModule, ChatsModule, MessagesModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramPollingService]
})
export class TelegramModule {}
