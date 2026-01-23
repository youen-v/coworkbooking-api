import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { ReservationStatus } from "@prisma/client";

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

    if (reservation.status !== ReservationStatus.PENDING_PAYMENT) {
      throw new BadRequestException("Reservation not in payment state");
    }

    // Prix démo 15€
    const amountCents = 1500;

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.STRIPE_CANCEL_URL}?session_id={CHECKOUT_SESSION_ID}`,

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents,
            product_data: {
              name: `Réservation - ${reservation.resource.name}`,
              description: `Du ${reservation.startAt.toISOString()} au ${reservation.endAt.toISOString()}`,
            },
          },
        },
      ],

      // Clé de la réservation dans le webhook
      metadata: {
        reservationId: reservation.id,
      },
    });

    // Stockage de la session Stripe
    await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        stripeSessionId: session.id,
      },
    });

    return { url: session.url };
  }
}
