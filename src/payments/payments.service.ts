import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PaymentsService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  constructor(private prisma: PrismaService) {}

  async createCheckoutSession(clerkUserId: string, reservationId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) throw new BadRequestException("User not found");

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { resource: true },
    });

    if (!reservation) throw new NotFoundException("Reservation not found");
    if (reservation.userId !== user.id)
      throw new BadRequestException("Not your reservation");

    // Si paiement en pending
    if (reservation.status !== "PENDING_PAYMENT") {
      throw new BadRequestException("Reservation not in payment state");
    }

    // DEMO
    const amountCents = 1500; // 15€
    const currency = "eur";

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: `Réservation - ${reservation.resource.name}`,
              description: `Du ${reservation.startAt.toISOString()} au ${reservation.endAt.toISOString()}`,
            },
          },
        },
      ],
      success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.STRIPE_CANCEL_URL}?reservationId=${reservationId}`,
      metadata: {
        reservationId,
        clerkUserId,
      },
    });

    await this.prisma.payment.create({
      data: {
        reservationId,
        stripeSessionId: session.id,
        amountCents,
        currency,
        status: "PENDING",
      },
    });

    return { url: session.url };
  }
}
