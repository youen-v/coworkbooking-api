import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { verifyToken } from "@clerk/backend";
import type { Request } from "express";

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    const authHeader = req.headers.authorization;

    // Express peut donner string | string[] | undefined
    const auth =
      typeof authHeader === "string"
        ? authHeader
        : Array.isArray(authHeader)
          ? authHeader[0]
          : undefined;

    if (!auth || !auth.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Authorization Bearer token");
    }

    const token = auth.slice("Bearer ".length).trim();

    try {
      const verified = await verifyToken(token, {
        jwtKey: process.env.CLERK_JWT_KEY!,
        authorizedParties: [process.env.CLERK_AUTHORIZED_PARTY!],
      });

      req.clerkUserId = verified.sub;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid session token");
    }
  }
}
