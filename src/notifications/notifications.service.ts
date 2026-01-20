import { Injectable } from "@nestjs/common";
import { Resend } from "resend";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  private resend = new Resend(process.env.RESEND_API_KEY!);

  constructor(private prisma: PrismaService) {}

  private adminEmails(): string[] {
    const raw = process.env.ADMIN_EMAILS || "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private async safeSend(to: string | string[], subject: string, html: string) {
    try {
      await this.resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to,
        subject,
        html,
      });

      const toStr = Array.isArray(to) ? to.join(",") : to;
      await this.prisma.emailLog.create({
        data: { to: toStr, subject, status: "SENT" },
      });
    } catch (err: any) {
      const toStr = Array.isArray(to) ? to.join(",") : to;
      await this.prisma.emailLog.create({
        data: {
          to: toStr,
          subject,
          status: "FAILED",
          errorMsg: String(err?.message || err),
        },
      });
      // ❗ ne bloque jamais
    }
  }

  async safeReservationCreated(res: any) {
    const subjectUser = `Confirmation de réservation - ${res.resource.name}`;
    const htmlUser = `
      <h2>Réservation confirmée</h2>
      <p>Ressource : <strong>${res.resource.name}</strong></p>
      <p>Début : ${res.startAt}</p>
      <p>Fin : ${res.endAt}</p>
      <p>Statut : ${res.status}</p>
      <p><a href="${process.env.APP_URL}">Accéder à l'application</a></p>
    `;

    await this.safeSend(res.user.email, subjectUser, htmlUser);

    const admins = this.adminEmails();
    if (admins.length) {
      await this.safeSend(admins, `Nouvelle réservation créée`, htmlUser);
    }
  }

  async safeReservationUpdated(res: any) {
    await this.safeSend(
      res.user.email,
      `Modification de réservation - ${res.resource.name}`,
      `<p>Votre réservation a été modifiée.</p><p>${res.startAt} → ${res.endAt}</p>`,
    );
  }

  async safeReservationCancelled(res: any) {
    await this.safeSend(
      res.user.email,
      `Annulation de réservation - ${res.resource.name}`,
      `<p>Votre réservation a été annulée.</p>`,
    );

    const admins = this.adminEmails();
    if (admins.length) {
      await this.safeSend(
        admins,
        `Annulation de réservation`,
        `<p>Annulation sur ${res.resource.name}</p>`,
      );
    }
  }
}
