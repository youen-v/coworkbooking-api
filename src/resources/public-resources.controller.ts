import { Controller, Get, Param } from "@nestjs/common";
import { ResourcesService } from "./resources.service";

@Controller("/api/v1/public/resources")
export class PublicResourcesController {
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
  async slots(@Param("id") id: string) {
    return { data: await this.service.getSlots(id) };
  }
}
