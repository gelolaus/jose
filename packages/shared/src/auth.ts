import { z } from "zod";

export const userRoleSchema = z.enum(["student", "teacher", "admin"]);

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: userRoleSchema,
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;

export const DEMO_TEACHER_ID = "demo-teacher";
export const DEMO_ADMIN_ID = "demo-admin";
export const JOSE_USER_HEADER = "x-jose-user-id";
