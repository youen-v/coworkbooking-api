import { Controller, Post, Req, Res } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { ReservationStatus } from "@prisma/client";

@Controller("/api/v1/webhooks")
export class StripeWebhookController {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  constructor(private prisma: PrismaService) {}

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
      const paid = session.payment_status === "paid"; // sécurité

      if (reservationId && paid) {
        await this.prisma.reservation.update({
          where: { id: reservationId },
          data: {
            status: ReservationStatus.ACTIVE,
            paidAt: new Date(),
          },
        });
      }
    }

    // ✅ Paiement expiré
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const reservationId = session.metadata?.reservationId;

      if (reservationId) {
        await this.prisma.reservation.update({
          where: { id: reservationId },
          data: {
            status: ReservationStatus.CANCELLED,
          },
        });
      }
    }

    return res.json({ received: true });
  }
}
