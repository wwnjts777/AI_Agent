import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../common/auth-user.decorator";
import { AuthGuard } from "../common/auth.guard";
import { BotsService } from "./bots.service";
import { CreateBotDto, UpdateBotDto } from "./bots.dto";

@Controller("bots")
@UseGuards(AuthGuard)
export class BotsController {
  constructor(private readonly bots: BotsService) {}

  @Get()
  list() {
    return this.bots.list();
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBotDto) {
    return this.bots.create(dto, user.sub);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.bots.get(id);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateBotDto) {
    return this.bots.update(id, dto, user.sub);
  }

  @Post(":id/test")
  test(@Param("id") id: string) {
    return this.bots.test(id);
  }

  @Post(":id/webhook")
  setWebhook(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bots.setWebhook(id, user.sub);
  }

  @Get(":id/webhook")
  getWebhook(@Param("id") id: string) {
    return this.bots.getWebhookInfo(id);
  }

  @Delete(":id/webhook")
  deleteWebhook(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bots.deleteWebhook(id, user.sub);
  }
}
