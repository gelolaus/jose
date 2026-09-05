import { SetMetadata } from "@nestjs/common";
import type { AccountRole } from "@jose/shared";

export const ROLES_KEY = "jose_roles";
export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);
