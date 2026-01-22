import { Controller, Get, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";
import { AdminService } from "./admin.service";

@Controller("/api/v1/admin")
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private service: AdminService) {}

  @Get("/reservations")
  async reservations() {
    return { data: await this.service.listAllReservations() };
  }

  @Get("/stats")
  async stats() {
    return { data: await this.service.stats() };
  }
}
