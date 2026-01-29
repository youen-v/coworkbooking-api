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
import { UpdateReservationDto } from "./dto/update-reservation.dto";

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
        status: ReservationStatus.PENDING_PAYMENT,
      },
      include: { resource: true, user: true },
    });

    return reservation;
  }

  async update(clerkUserId: string, id: string, dto: UpdateReservationDto) {
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

    // MAJ nouvelles valeurs
    const newResourceId =
      dto.resourceId && dto.resourceId.trim().length > 0
        ? dto.resourceId.trim()
        : existing.resourceId;

    const newStartAt = dto.startAt
      ? this.parseDate(dto.startAt)
      : existing.startAt;
    const newEndAt = dto.endAt ? this.parseDate(dto.endAt) : existing.endAt;

    if (newEndAt <= newStartAt) {
      throw new BadRequestException("endAt must be after startAt");
    }

    // Vérification de la disponibilité de la ressource
    const resource = await this.prisma.resource.findUnique({
      where: { id: newResourceId },
    });

    if (!resource || !resource.enabled) {
      throw new NotFoundException("Resource not available");
    }

    // Gestion des conflits avec le statut du paiement sur la ressource cible
    const conflict = await this.prisma.reservation.findFirst({
      where: {
        id: { not: id },
        resourceId: newResourceId,
        status: {
          in: [
            ReservationStatus.PENDING_PAYMENT,
            ReservationStatus.ACTIVE,
            ReservationStatus.MODIFIED,
          ],
        },
        AND: [{ startAt: { lt: newEndAt } }, { endAt: { gt: newStartAt } }],
      },
    });

    if (conflict) throw new ConflictException("Slot already booked");

    // Si réservation était PENDING_PAYMENT : on garde PENDING_PAYMENT
    // Si ACTIVE/MODIFIED : on passe en MODIFIED
    const nextStatus =
      existing.status === ReservationStatus.PENDING_PAYMENT
        ? ReservationStatus.PENDING_PAYMENT
        : ReservationStatus.MODIFIED;

    // Si le user modifie la ressource mais quelle n’est pas encore payé reset stripeSessionId
    const shouldResetStripeSession =
      existing.status === ReservationStatus.PENDING_PAYMENT;

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: {
        resourceId: newResourceId,
        startAt: newStartAt,
        endAt: newEndAt,
        status: nextStatus,
        stripeSessionId: shouldResetStripeSession
          ? null
          : existing.stripeSessionId,
      },
      include: { resource: true, user: true },
    });

    // Email confirmation modification
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

    if (existing.status === ReservationStatus.CANCELLED) {
      return existing;
    }

    const cancelled = await this.prisma.reservation.update({
      // annulation session paiement avec reset stripeSessionId
      where: { id },
      data: {
        status: ReservationStatus.CANCELLED,
        stripeSessionId: null,
      },
      include: { resource: true, user: true },
    });

    // Email d'annulation
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

  async getOne(clerkUserId: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) throw new BadRequestException("User not found");

    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { resource: true, user: true },
    });

    if (!reservation) throw new NotFoundException("Reservation not found");
    if (reservation.userId !== user.id)
      throw new BadRequestException("Not your reservation");

    return reservation;
  }
}
