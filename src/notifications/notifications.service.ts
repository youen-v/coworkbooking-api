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
  // private async safeSend(to: string | string[], subject: string, html: string) {
  //     try {
  //       const result = await this.resend.emails.send({
  //         from: process.env.EMAIL_FROM!,
  //         to,
  //         subject,
  //         html,
  //       });

  //       console.log("[RESEND] raw result =", JSON.stringify(result));

  //       const toStr = Array.isArray(to) ? to.join(",") : to;
  //       await this.prisma.emailLog.create({
  //         data: { to: toStr, subject, status: "SENT" },
  //       });
  //     } catch (err: any) {
  //       console.log("[RESEND] error =", err);
  //       const toStr = Array.isArray(to) ? to.join(",") : to;
  //       await this.prisma.emailLog.create({
  //         data: {
  //           to: toStr,
  //           subject,
  //           status: "FAILED",
  //           errorMsg: String(err?.message || err),
  //         },
  //       });
  //     }
  //   }
  private async safeSend(to: string | string[], subject: string, html: string) {
    try {
      const result = await this.resend.emails.send({
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
    }
  }

  async safeReservationCreated(res: any) {
    const subject = `Confirmation de réservation - ${res.resource.name}`;
    const html = `
      <h2>Réservation confirmée</h2>
      <p>Ressource : <strong>${res.resource.name}</strong></p>
      <p>Début : ${res.startAt}</p>
      <p>Fin : ${res.endAt}</p>
      <p>Statut : ${res.status}</p>
      <p><a href="${process.env.APP_URL}">Accéder à l'application</a></p>
    `;

    await this.safeSend(res.user.email, subject, html);
  }

  async safeReservationUpdated(res: any) {
    const subject = `Réservation modifiée - ${res.resource.name}`;

    const html = `
    <h2>Votre réservation a été modifiée</h2>
    <p><strong>Salle :</strong> ${res.resource.name}</p>
    <p><strong>Début :</strong> ${new Date(res.startAt).toLocaleString()}</p>
    <p><strong>Fin :</strong> ${new Date(res.endAt).toLocaleString()}</p>
    <p><strong>Statut :</strong> ${res.status}</p>

    <p><a href="${process.env.APP_URL}/app/reservations">Voir mes réservations</a></p>
  `;

    await this.safeSend(res.user.email, subject, html);
  }

  async safeReservationCancelled(res: any) {
    const subject = `Réservation annulée - ${res.resource.name}`;

    const html = `
    <h2>Votre réservation a été annulée</h2>
    <p><strong>Salle :</strong> ${res.resource.name}</p>
    <p><strong>Début :</strong> ${new Date(res.startAt).toLocaleString()}</p>
    <p><strong>Fin :</strong> ${new Date(res.endAt).toLocaleString()}</p>
    <p><strong>Statut :</strong> ${res.status}</p>

    <p>Si vous souhaitez réserver un autre créneau :</p>
    <p><a href="${process.env.APP_URL}/rooms">Retour aux salles</a></p>
  `;

    await this.safeSend(res.user.email, subject, html);

    const admins = this.adminEmails();
    if (admins.length) {
      await this.safeSend(
        admins,
        `Annulation réservation - ${res.resource.name}`,
        html,
      );
    }
  }
}
