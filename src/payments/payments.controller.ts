import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { PaymentsService } from "./payments.service";

@Controller("/api/v1/payments")
@UseGuards(ClerkAuthGuard)
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post("/checkout-session")
  async createCheckout(
    @Req() req: any,
    @Body() body: { reservationId: string },
  ) {
    const data = await this.payments.createCheckoutSession(
      req.clerkUserId,
      body.reservationId,
    );
    return { data };
  }
}
