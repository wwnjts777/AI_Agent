import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthUser, CurrentUser } from "../common/auth-user.decorator";
import { AuthGuard } from "../common/auth.guard";
import { CreateAiAgentDto, UpdateAiAgentDto } from "./ai-agents.dto";
import { AiAgentsService } from "./ai-agents.service";

@Controller("ai-agents")
@UseGuards(AuthGuard)
export class AiAgentsController {
  constructor(private readonly agents: AiAgentsService) {}

  @Get()
  list() {
    return this.agents.list();
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAiAgentDto) {
    return this.agents.create(dto, user.sub);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAiAgentDto) {
    return this.agents.update(id, dto, user.sub);
  }

  @Post(":id/test")
  test(@Param("id") id: string) {
    return this.agents.test(id);
  }
}
