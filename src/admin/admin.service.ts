import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listAllReservations() {
    return this.prisma.reservation.findMany({
      include: { user: true, resource: true },
      orderBy: { startAt: "desc" },
    });
  }

  async stats() {
    const [resources, reservationsActive] = await Promise.all([
      this.prisma.resource.count(),
      this.prisma.reservation.count({
        where: { status: { in: ["ACTIVE", "MODIFIED"] } },
      }),
    ]);

    return { resources, reservationsActive };
  }
}
