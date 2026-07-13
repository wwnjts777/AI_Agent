import { Module } from "@nestjs/common";
import { BotsModule } from "../bots/bots.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [BotsModule],
  controllers: [HealthController]
})
export class HealthModule {}
