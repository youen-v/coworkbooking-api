import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { User } from "@prisma/client";
import { createClerkClient } from "@clerk/backend";

@Injectable()
export class UsersService {
  private clerk = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  constructor(private readonly prisma: PrismaService) {}

  private async getClerkProfile(clerkUserId: string) {
    const clerkUser = await this.clerk.users.getUser(clerkUserId);

    const primaryEmailId = clerkUser.primaryEmailAddressId;
    const email =
      clerkUser.emailAddresses.find((e) => e.id === primaryEmailId)
        ?.emailAddress ||
      clerkUser.emailAddresses[0]?.emailAddress ||
      `user-${clerkUserId}@example.com`;

    const fullName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      null;

    return { email, fullName };
  }

  async getOrCreateUser(clerkUserId: string): Promise<{ data: User }> {
    const existing = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    const { email, fullName } = await this.getClerkProfile(clerkUserId);

    if (existing) {
      const needsUpdate =
        existing.email !== email ||
        (fullName && existing.fullName !== fullName);

      if (!needsUpdate) return { data: existing };

      const updated = await this.prisma.user.update({
        where: { clerkUserId },
        data: { email, fullName },
      });

      return { data: updated };
    }

    const created = await this.prisma.user.create({
      data: {
        clerkUserId,
        email,
        fullName,
        role: "USER",
      },
    });

    return { data: created };
  }
}
