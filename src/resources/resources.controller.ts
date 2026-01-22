import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UserRole } from "@prisma/client";
import { ResourcesService } from "./resources.service";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { Patch } from "@nestjs/common";

@Controller("/api/v1/resources")
export class ResourcesController {
  constructor(private service: ResourcesService) {}

  @Get()
  async list() {
    return { data: await this.service.listEnabled() };
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    return { data: await this.service.getById(id) };
  }

  @Get(":id/slots")
  async slots(
    @Param("id") id: string,
    @Query("date") date: string,
    @Query("duration") duration?: string,
  ) {
    const dur = duration ? Number(duration) : 60;
    return { data: await this.service.getSlotsForDate(id, date, dur) };
  }

  // ADMIN
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() dto: CreateResourceDto) {
    return { data: await this.service.create(dto) };
  }

  // ADMIN
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: Partial<CreateResourceDto>,
  ) {
    return { data: await this.service.update(id, dto) };
  }

  // ADMIN
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id/disable")
  async disable(@Param("id") id: string) {
    return { data: await this.service.disable(id) };
  }
}
