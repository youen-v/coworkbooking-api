import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateResourceDto } from "./dto/create-resource.dto";

@Injectable()
export class ResourcesService {
  constructor(private prisma: PrismaService) {}

  private dayKey(d: Date) {
    const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return keys[d.getDay()];
  }

  private parseTimeToDate(base: Date, hhmm: string) {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
  }

  private overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && aEnd > bStart;
  }

  listEnabled() {
    return this.prisma.resource.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(id: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException("Resource not found");
    return resource;
  }

  create(dto: CreateResourceDto) {
    return this.prisma.resource.create({ data: dto as any });
  }

  update(id: string, dto: Partial<CreateResourceDto>) {
    return this.prisma.resource.update({
      where: { id },
      data: dto as any,
    });
  }

  disable(id: string) {
    return this.prisma.resource.update({
      where: { id },
      data: { enabled: false },
    });
  }

  async getSlotsForDate(
    resourceId: string,
    dateISO: string,
    durationMin: number,
  ) {
    const resource = await this.getById(resourceId);

    const base = new Date(dateISO);
    if (isNaN(base.getTime())) {
      throw new Error("Invalid date format. Use YYYY-MM-DD");
    }

    base.setHours(0, 0, 0, 0);

    const key = this.dayKey(base);
    const availability = resource.availability as any;

    const ranges: string[] = availability?.[key] || [];
    if (!ranges.length) return [];

    // Toutes les réservations de la journée
    const dayStart = new Date(base);
    const dayEnd = new Date(base);
    dayEnd.setHours(23, 59, 59, 999);

    const booked = await this.prisma.reservation.findMany({
      where: {
        resourceId,
        status: { in: ["ACTIVE", "MODIFIED"] },
        AND: [{ startAt: { lt: dayEnd } }, { endAt: { gt: dayStart } }],
      },
      select: { startAt: true, endAt: true },
    });

    const step = 30; // minutes
    const slots: { startAt: string; endAt: string }[] = [];

    for (const r of ranges) {
      const [from, to] = r.split("-");
      const openStart = this.parseTimeToDate(base, from);
      const openEnd = this.parseTimeToDate(base, to);

      for (
        let cursor = new Date(openStart);
        cursor.getTime() + durationMin * 60_000 <= openEnd.getTime();
        cursor = new Date(cursor.getTime() + step * 60_000)
      ) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor.getTime() + durationMin * 60_000);

        const conflict = booked.some((b) =>
          this.overlaps(slotStart, slotEnd, b.startAt, b.endAt),
        );

        if (!conflict) {
          slots.push({
            startAt: slotStart.toISOString(),
            endAt: slotEnd.toISOString(),
          });
        }
      }
    }

    return slots;
  }
}
