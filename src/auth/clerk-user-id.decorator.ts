import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const ClerkUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();

    if (!req.clerkUserId) {
      throw new Error("clerkUserId missing on request");
    }

    return req.clerkUserId;
  },
);
