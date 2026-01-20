import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { ReservationsService } from "./reservations.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";

@Controller("/api/v1/reservations")
@UseGuards(ClerkAuthGuard)
export class ReservationsController {
  constructor(private service: ReservationsService) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateReservationDto) {
    return { data: await this.service.create(req.clerkUserId, dto) };
  }

  @Put(":id")
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: CreateReservationDto,
  ) {
    return { data: await this.service.update(req.clerkUserId, id, dto) };
  }

  @Delete(":id")
  async cancel(@Req() req: any, @Param("id") id: string) {
    return { data: await this.service.cancel(req.clerkUserId, id) };
  }

  @Get("me")
  async mine(@Req() req: any) {
    return { data: await this.service.myReservations(req.clerkUserId) };
  }
}
