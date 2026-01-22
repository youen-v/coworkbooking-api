import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { PaymentsService } from "./payments.service";

@Controller("/api/v1/payments")
@UseGuards(ClerkAuthGuard)
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Post("/checkout-session")
  async checkout(@Req() req: any, @Body() body: { reservationId: string }) {
    return {
      data: await this.service.createCheckoutSession(
        req.clerkUserId,
        body.reservationId,
      ),
    };
  }
}
