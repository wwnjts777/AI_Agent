import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateBotDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(10)
  token!: string;
}

export class UpdateBotDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  token?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
