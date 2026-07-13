import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../common/auth.guard";
import { ChatsService } from "./chats.service";

@Controller("chats")
@UseGuards(AuthGuard)
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get()
  list(
    @Query("search") search?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
    @Query("botId") botId?: string
  ) {
    return this.chats.list(search, limit ? Number(limit) : 50, cursor, botId);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.chats.detail(id);
  }

  @Post(":id/read")
  read(@Param("id") id: string) {
    return this.chats.markRead(id);
  }
}
