import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { User } from "@prisma/client";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateUser(clerkUserId: string): Promise<{ data: User }> {
    const existing: User | null = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (existing) return { data: existing };

    // TODO: Remplacer par des vraies données Clerk
    const created: User = await this.prisma.user.create({
      data: {
        clerkUserId,
        email: `user-${clerkUserId}@example.com`,
        fullName: null,
        role: "USER",
      },
    });

    return { data: created };
  }
}
