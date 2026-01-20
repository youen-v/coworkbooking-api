import { Controller, Get, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { ClerkUserId } from "../auth/clerk-user-id.decorator";
import { UsersService } from "./users.service";

@Controller("/api/v1")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(ClerkAuthGuard)
  @Get("/me")
  async me(@ClerkUserId() clerkUserId: string) {
    return this.usersService.getOrCreateUser(clerkUserId);
  }
}
