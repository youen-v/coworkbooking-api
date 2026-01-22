import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { ReservationStatus } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private parseDate(value: string) {
    const d = new Date(value);
    if (isNaN(d.getTime()))
      throw new BadRequestException("Invalid date format");
    return d;
  }

  private async ensureUser(clerkUserId: string) {
    let user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (user) return user;

    // Création automatique du user si pas existant
    user = await this.prisma.user.create({
      data: {
        clerkUserId,
        email: `user-${clerkUserId}@example.com`,
        fullName: null,
        role: "USER",
      },
    });

    return user;
  }

  async create(clerkUserId: string, dto: CreateReservationDto) {
    const startAt = this.parseDate(dto.startAt);
    const endAt = this.parseDate(dto.endAt);

    if (endAt <= startAt)
      throw new BadRequestException("endAt must be after startAt");

    const user = await this.ensureUser(clerkUserId);

    // Vérification des ressources
    const resource = await this.prisma.resource.findUnique({
      where: { id: dto.resourceId },
    });
    if (!resource || !resource.enabled)
      throw new NotFoundException("Resource not available");

    const conflict = await this.prisma.reservation.findFirst({
      where: {
        resourceId: dto.resourceId,
        status: {
          in: [
            ReservationStatus.PENDING_PAYMENT,
            ReservationStatus.ACTIVE,
            ReservationStatus.MODIFIED,
          ],
        },
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
    });

    if (conflict) throw new ConflictException("Slot already booked");

    const reservation = await this.prisma.reservation.create({
      data: {
        userId: user.id,
        resourceId: dto.resourceId,
        startAt,
        endAt,
        status: ReservationStatus.ACTIVE,
      },
      include: { resource: true, user: true },
    });

    // Email user + admin
    this.notifications.safeReservationCreated(reservation).catch(() => {});

    return reservation;
  }

  async update(clerkUserId: string, id: string, dto: CreateReservationDto) {
    const startAt = this.parseDate(dto.startAt);
    const endAt = this.parseDate(dto.endAt);

    const user = await this.ensureUser(clerkUserId);

    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { resource: true, user: true },
    });

    if (!existing) throw new NotFoundException("Reservation not found");
    if (existing.userId !== user.id)
      throw new BadRequestException("Not your reservation");
    if (existing.status === ReservationStatus.CANCELLED)
      throw new BadRequestException("Reservation cancelled");

    const conflict = await this.prisma.reservation.findFirst({
      where: {
        id: { not: id },
        resourceId: existing.resourceId,
        status: { in: [ReservationStatus.ACTIVE, ReservationStatus.MODIFIED] },
        AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
      },
    });

    if (conflict) throw new ConflictException("Slot already booked");

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        startAt,
        endAt,
        status: ReservationStatus.MODIFIED,
      },
      include: { resource: true, user: true },
    });

    this.notifications.safeReservationUpdated(updated).catch(() => {});
    return updated;
  }

  async cancel(clerkUserId: string, id: string) {
    const user = await this.ensureUser(clerkUserId);

    const existing = await this.prisma.reservation.findUnique({
      where: { id },
      include: { resource: true, user: true },
    });

    if (!existing) throw new NotFoundException("Reservation not found");
    if (existing.userId !== user.id)
      throw new BadRequestException("Not your reservation");

    const cancelled = await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED },
      include: { resource: true, user: true },
    });

    this.notifications.safeReservationCancelled(cancelled).catch(() => {});
    return cancelled;
  }

  async myReservations(clerkUserId: string) {
    const user = await this.ensureUser(clerkUserId);

    const data = await this.prisma.reservation.findMany({
      where: { userId: user.id },
      include: { resource: true },
      orderBy: { startAt: "desc" },
    });

    return data;
  }
}
