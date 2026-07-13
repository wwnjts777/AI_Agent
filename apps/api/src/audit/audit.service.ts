import { Injectable } from "@nestjs/common";
import { PrismaService } from "@telegram-hub/database";

type AuditInput = {
  actorUserId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined
      }
    });
  }

  async list(limit = 50) {
    return this.prisma.auditLog.findMany({
      take: Math.min(limit, 100),
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, email: true, name: true } } }
    });
  }
}
