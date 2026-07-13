import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { MESSAGE_LIMIT } from "../common/validation";

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_LIMIT)
  text?: string;

  @IsOptional()
  @IsUUID()
  clientRequestId?: string;
}
