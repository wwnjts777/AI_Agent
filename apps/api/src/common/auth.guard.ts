import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const cookieName = process.env.COOKIE_NAME ?? "telegram_hub_session";
    const token = request.cookies?.[cookieName];
    if (!token) throw new UnauthorizedException({ code: "AUTH_UNAUTHORIZED", message: "Sesi tidak valid." });
    try {
      request.user = this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET ?? "dev-secret" });
      return true;
    } catch {
      throw new UnauthorizedException({ code: "AUTH_UNAUTHORIZED", message: "Sesi tidak valid." });
    }
  }
}
