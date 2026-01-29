import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReservationStatus } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private parseDateOrUndefined(v?: string) {
    if (!v) return undefined;
    const d = new Date(v);
    if (isNaN(d.getTime()))
      throw new BadRequestException("Invalid date query param");
    return d;
  }
  private notifications: NotificationsService;

  async listAllReservations(filters: {
    status?: string;
    resourceId?: string;
    email?: string;
    from?: string;
    to?: string;
  }) {
    const from = this.parseDateOrUndefined(filters.from);
    const to = this.parseDateOrUndefined(filters.to);

    return this.prisma.reservation.findMany({
      where: {
        ...(filters.status
          ? { status: filters.status as ReservationStatus }
          : {}),
        ...(filters.resourceId ? { resourceId: filters.resourceId } : {}),
        ...(from || to
          ? {
              startAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
        ...(filters.email
          ? {
              user: {
                email: { contains: filters.email, mode: "insensitive" },
              },
            }
          : {}),
      },
      include: { user: true, resource: true },
      orderBy: { startAt: "desc" },
    });
  }

  async listUsers(q?: string) {
    return this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { fullName: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listResources() {
    return this.prisma.resource.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async adminCancelReservation(id: string) {
    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { user: true, resource: true },
    });

    if (!existing) throw new NotFoundException("Reservation not found");

    // autorise annulation même si pending
    const cancelled = await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED },
      include: { user: true, resource: true },
    });

    // email d'annulation
    this.notifications.safeReservationCancelled(cancelled).catch(() => {});

    return cancelled;
  }

  async stats() {
    const [resources, active, pending, cancelled] = await Promise.all([
      this.prisma.resource.count(),
      this.prisma.reservation.count({
        where: { status: { in: ["ACTIVE", "MODIFIED"] } },
      }),
      this.prisma.reservation.count({
        where: { status: "PENDING_PAYMENT" } as any,
      }),
      this.prisma.reservation.count({ where: { status: "CANCELLED" } }),
    ]);

    return {
      resources,
      reservationsActive: active,
      reservationsPending: pending,
      reservationsCancelled: cancelled,
    };
  }
}
