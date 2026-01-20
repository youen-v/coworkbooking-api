import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UserRole } from "@prisma/client";
import { ResourcesService } from "./resources.service";
import { CreateResourceDto } from "./dto/create-resource.dto";

@Controller("/api/v1/resources")
export class ResourcesController {
  constructor(private service: ResourcesService) {}

  @UseGuards(ClerkAuthGuard)
  @Get()
  async list() {
    return { data: await this.service.listEnabled() };
  }

  @UseGuards(ClerkAuthGuard)
  @Get(":id")
  async get(@Param("id") id: string) {
    return { data: await this.service.getById(id) };
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
}
