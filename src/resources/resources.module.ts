import { Module } from "@nestjs/common";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";
import { PublicResourcesController } from "./public-resources.controller";

@Module({
  controllers: [ResourcesController, PublicResourcesController],
  providers: [ResourcesService],
})
export class ResourcesModule {}
