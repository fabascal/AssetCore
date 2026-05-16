import { Request } from "express";

export type AuthUser = {
  id: number;
  email: string;
  roleId: number;
  roleName: string;
  permissions: string[];
};

export type AuthRequest = Request & {
  user?: AuthUser;
};
