import { Test } from "@nestjs/testing";
import { pathResponseSchema } from "@jose/shared";
import { PathController } from "./path.controller";
import { PathService } from "./path.service";

describe("PathController", () => {
  it("returns a schema-valid demo path", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PathController],
      providers: [PathService],
    }).compile();

    const controller = moduleRef.get(PathController);
    const body = controller.getDemo();
    expect(pathResponseSchema.parse(body).sections.length).toBeGreaterThan(0);
  });
});
