import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { BotsModule } from "../bots/bots.module";
import { AiAgentsController } from "./ai-agents.controller";
import { AiAgentsService } from "./ai-agents.service";

@Module({
  imports: [AuditModule, BotsModule],
  controllers: [AiAgentsController],
  providers: [AiAgentsService],
  exports: [AiAgentsService]
})
export class AiAgentsModule {}
