import { IsBoolean, IsOptional, IsString, IsUrl, Matches, MinLength } from "class-validator";

export class CreateAiAgentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  provider!: string;

  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsString()
  @MinLength(1)
  modelId!: string;

  @IsString()
  @MinLength(10)
  apiKey!: string;
}

export class UpdateAiAgentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  provider?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  modelId?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  workspaceAccess?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9._/\-]*$/)
  workspaceRoot?: string;
}
