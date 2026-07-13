import { Module } from "@nestjs/common";
import { AiAgentsModule } from "../ai-agents/ai-agents.module";
import { AuditModule } from "../audit/audit.module";
import { BotsModule } from "../bots/bots.module";
import { EventsModule } from "../events/events.module";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";

@Module({
  imports: [AiAgentsModule, AuditModule, BotsModule, EventsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService]
})
export class MessagesModule {}
