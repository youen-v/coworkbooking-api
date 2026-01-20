import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { UserRole } from "@prisma/client";

import { ROLES_KEY } from "./roles.decorator";
import { PrismaService } from "../prisma/prisma.service";

type UserRoleOnly = { role: UserRole };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();

    const clerkUserId = req.clerkUserId;
    if (!clerkUserId) {
      throw new UnauthorizedException("Missing authenticated user context");
    }

    const user: UserRoleOnly | null = await this.prisma.user.findUnique({
      where: { clerkUserId },
      select: { role: true },
    });

    if (!user) throw new ForbiddenException("User not found in DB");

    if (!roles.includes(user.role)) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
