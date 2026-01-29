import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { ReservationStatus } from "@prisma/client";

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

  async getSlots(resourceId: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource || !resource.enabled) {
      throw new NotFoundException("Resource not available");
    }

    const durationMin = resource.durationMin ?? 60;

    // ✅ availability : { mon:["09:00-18:00"], tue:["09:00-18:00"], ... }
    const availability = (resource.availability || {}) as Record<
      string,
      string[]
    >;

    // ✅ jours à générer : aujourd'hui + 7 jours
    const now = new Date();
    const days = 7;

    // ✅ récup toutes les réservations qui impactent la dispo (non cancelled)
    const existing = await this.prisma.reservation.findMany({
      where: {
        resourceId,
        status: {
          in: [
            ReservationStatus.PENDING_PAYMENT,
            ReservationStatus.ACTIVE,
            ReservationStatus.MODIFIED,
          ],
        },
        endAt: { gt: now }, // seulement celles dans le futur
      },
      select: {
        startAt: true,
        endAt: true,
      },
    });

    // Utilitaire : overlap test
    const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
      return aStart < bEnd && aEnd > bStart;
    };

    // util : convert hh:mm -> minutes
    const toMinutes = (hhmm: string) => {
      const [hh, mm] = hhmm.split(":").map(Number);
      return hh * 60 + mm;
    };

    // util : day key
    const dayKey = (d: Date) => {
      const day = d.getDay(); // 0=dim,1=lun...
      return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][day];
    };

    // util : build date at day + minutes
    const dateAtMinutes = (base: Date, minutes: number) => {
      const d = new Date(base);
      d.setHours(0, 0, 0, 0);
      d.setMinutes(minutes);
      return d;
    };

    // fallback si availability vide
    const fallback: Record<string, string[]> = {
      mon: ["09:00-18:00"],
      tue: ["09:00-18:00"],
      wed: ["09:00-18:00"],
      thu: ["09:00-18:00"],
      fri: ["09:00-18:00"],
    };

    const rules =
      Object.keys(availability).length > 0 ? availability : fallback;

    const slots: { startAt: string; endAt: string }[] = [];

    for (let i = 0; i < days; i++) {
      const day = new Date(now);
      day.setDate(now.getDate() + i);

      // on construit la liste de ranges pour ce jour
      const key = dayKey(day);
      const ranges = rules[key] || [];

      for (const range of ranges) {
        const [startStr, endStr] = range.split("-");
        if (!startStr || !endStr) continue;

        const startMin = toMinutes(startStr);
        const endMin = toMinutes(endStr);

        if (endMin <= startMin) continue;

        // génère des slots de durationMin
        let cursor = startMin;

        while (cursor + durationMin <= endMin) {
          const startAt = dateAtMinutes(day, cursor);
          const endAt = dateAtMinutes(day, cursor + durationMin);

          // ignore si créneau passé (jour 0)
          if (endAt <= now) {
            cursor += durationMin;
            continue;
          }

          // check conflit DB
          const conflict = existing.some((r) =>
            overlaps(startAt, endAt, r.startAt, r.endAt),
          );

          if (!conflict) {
            slots.push({
              startAt: startAt.toISOString(),
              endAt: endAt.toISOString(),
            });
          }

          cursor += durationMin;
        }
      }
    }

    return slots;
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
