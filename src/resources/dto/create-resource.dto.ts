import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateResourceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsInt()
  @Min(30)
  durationMin!: number;

  @IsInt()
  @Min(30)
  durationMax!: number;

  // JSON simple
  availability!: any;
}
