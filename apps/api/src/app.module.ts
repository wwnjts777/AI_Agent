import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "@telegram-hub/database";
import { AiAgentsModule } from "./ai-agents/ai-agents.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BotsModule } from "./bots/bots.module";
import { ChatsModule } from "./chats/chats.module";
import { CommonAuthModule } from "./common/common-auth.module";
import { EventsModule } from "./events/events.module";
import { HealthModule } from "./health/health.module";
import { MessagesModule } from "./messages/messages.module";
import { TelegramModule } from "./telegram/telegram.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonAuthModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    PrismaModule,
    AiAgentsModule,
    EventsModule,
    AuditModule,
    AuthModule,
    BotsModule,
    TelegramModule,
    ChatsModule,
    MessagesModule,
    HealthModule
  ]
})
export class AppModule {}
