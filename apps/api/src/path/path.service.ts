import { Injectable } from "@nestjs/common";
import type { PathResponse } from "@jose/shared";
import { DEMO_PATH } from "./demo-path";

@Injectable()
export class PathService {
  getDemoPath(): PathResponse {
    return DEMO_PATH;
  }
}
