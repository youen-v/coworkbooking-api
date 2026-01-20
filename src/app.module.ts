import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { ResourcesModule } from "./resources/resources.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    NotificationsModule,
    UsersModule,
    ResourcesModule,
    ReservationsModule,
  ],
})
export class AppModule {}
