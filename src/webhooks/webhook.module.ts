import { Module } from "@nestjs/common";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [StripeWebhookController],
})
export class WebhooksModule {}
