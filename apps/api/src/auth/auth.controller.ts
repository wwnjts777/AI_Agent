import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { AuditService } from "../audit/audit.service";
import { CurrentUser, AuthUser } from "../common/auth-user.decorator";
import { AuthGuard } from "../common/auth.guard";
import { AuthService } from "./auth.service";
import { ChangePasswordDto, LoginDto } from "./auth.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly audit: AuditService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    response.cookie(process.env.COOKIE_NAME ?? "telegram_hub_session", result.token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/"
    });
    return result.user;
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    response.clearCookie(process.env.COOKIE_NAME ?? "telegram_hub_session", { path: "/" });
    await this.audit.record({ actorUserId: user.sub, action: "auth.logout", targetType: "User", targetId: user.sub });
    return { loggedOut: true };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.sub);
  }

  @Post("change-password")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}
