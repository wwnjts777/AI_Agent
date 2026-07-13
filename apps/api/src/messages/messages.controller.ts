import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { randomUUID } from "crypto";
import { Response } from "express";
import { mkdirSync } from "fs";
import { diskStorage } from "multer";
import { extname, resolve } from "path";
import { AuthUser, CurrentUser } from "../common/auth-user.decorator";
import { AuthGuard } from "../common/auth.guard";
import { SendMessageDto } from "./messages.dto";
import { MessagesService } from "./messages.service";

@Controller()
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get("chats/:id/messages")
  history(@Param("id") id: string, @Query("limit") limit?: string, @Query("cursor") cursor?: string) {
    return this.messages.history(id, limit ? Number(limit) : 50, cursor);
  }

  @Post("chats/:id/messages")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const destination = resolve(process.cwd(), "../../storage/uploads/outbound");
          mkdirSync(destination, { recursive: true });
          callback(null, destination);
        },
        filename: (_request, file, callback) => {
          callback(null, `${Date.now()}-${randomUUID()}${extname(file.originalname)}`);
        }
      }),
      limits: { fileSize: 25 * 1024 * 1024 }
    })
  )
  send(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const clientRequestId = dto.clientRequestId ?? randomUUID();
    if (file) return this.messages.sendFile(id, file, dto.text, clientRequestId, user.sub);
    return this.messages.send(id, dto.text ?? "", clientRequestId, user.sub);
  }

  @Get("messages/:id/file")
  async file(@Param("id") id: string, @Res() response: Response) {
    const file = await this.messages.fileFor(id);
    response.setHeader("content-type", file.mimeType);
    response.setHeader("content-disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
    return response.sendFile(file.absolutePath);
  }

  @Post("messages/:id/retry")
  retry(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.messages.retry(id, user.sub);
  }
}
