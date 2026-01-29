import {
  IsISO8601,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateIf,
} from "class-validator";

export class UpdateReservationDto {
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.resourceId !== undefined)
  @IsNotEmpty()
  resourceId?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;
}
