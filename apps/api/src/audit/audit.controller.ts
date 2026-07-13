import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../common/auth.guard";
import { AuditService } from "./audit.service";

@Controller("audit-logs")
@UseGuards(AuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query("limit") limit?: string) {
    return this.audit.list(limit ? Number(limit) : 50);
  }
}
