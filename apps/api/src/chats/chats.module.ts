import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { ChatsController } from "./chats.controller";
import { ChatsService } from "./chats.service";

@Module({
  imports: [EventsModule],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService]
})
export class ChatsModule {}
