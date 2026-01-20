import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateResourceDto } from "./dto/create-resource.dto";

@Injectable()
export class ResourcesService {
  constructor(private prisma: PrismaService) {}

  listEnabled() {
    return this.prisma.resource.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(id: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) throw new NotFoundException("Resource not found");
    return resource;
  }

  create(dto: CreateResourceDto) {
    return this.prisma.resource.create({ data: dto as any });
  }

  update(id: string, dto: Partial<CreateResourceDto>) {
    return this.prisma.resource.update({
      where: { id },
      data: dto as any,
    });
  }

  disable(id: string) {
    return this.prisma.resource.update({
      where: { id },
      data: { enabled: false },
    });
  }
}
