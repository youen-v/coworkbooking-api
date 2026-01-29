import { Controller, Post, Req, Res } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { ReservationStatus } from "@prisma/client";
import { NotificationsService } from "src/notifications/notifications.service";

@Controller("/api/v1/webhooks")
export class StripeWebhookController {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  @Post("/stripe")
  async handleStripe(@Req() req: any, @Res() res: any) {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    try {
      // req.body = Buffer grâce à express.raw()
      event = this.stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ✅ Paiement confirmé
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const reservationId = session.metadata?.reservationId;
      const paid = session.payment_status === "paid";

      if (reservationId && paid) {
        const updated = await this.prisma.reservation.update({
          where: { id: reservationId },
          data: {
            status: ReservationStatus.ACTIVE,
            paidAt: new Date(),
          },
          include: { user: true, resource: true },
        });

        this.notifications.safeReservationCreated(updated).catch(() => {});
      }
    }

    // ✅ Paiement expiré
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const reservationId = session.metadata?.reservationId;

      if (reservationId) {
        const cancelled = await this.prisma.reservation.update({
          where: { id: reservationId },
          data: { status: ReservationStatus.CANCELLED },
          include: { user: true, resource: true },
        });

        this.notifications.safeReservationCancelled(cancelled).catch(() => {});
      }
    }

    return res.json({ received: true });
  }
}
