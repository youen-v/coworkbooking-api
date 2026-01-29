import {
  Controller,
  Get,
  Query,
  UseGuards,
  Patch,
  Param,
} from "@nestjs/common";
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
  async reservations(
    @Query("status") status?: string,
    @Query("resourceId") resourceId?: string,
    @Query("email") email?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return {
      data: await this.service.listAllReservations({
        status,
        resourceId,
        email,
        from,
        to,
      }),
    };
  }

  @Get("/stats")
  async stats() {
    return { data: await this.service.stats() };
  }

  // ✅ liste des users (pour filtre / vue par utilisateur)
  @Get("/users")
  async users(@Query("q") q?: string) {
    return { data: await this.service.listUsers(q) };
  }

  // ✅ liste des salles (pour filtre / vue par salle)
  @Get("/resources")
  async resources() {
    return { data: await this.service.listResources() };
  }

  // ✅ action admin : annuler une réservation
  @Patch("/reservations/:id/cancel")
  async cancelReservation(@Param("id") id: string) {
    return { data: await this.service.adminCancelReservation(id) };
  }
}
