import { IsISO8601, IsNotEmpty, IsString } from "class-validator";

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @IsISO8601()
  startAt!: string;

  @IsISO8601()
  endAt!: string;
}
