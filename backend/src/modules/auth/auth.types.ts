import { MenuNode } from "../menus/menus.types";

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    fullName: string;
    email: string;
    role: {
      id: number;
      name: string;
    };
  };
  menus: MenuNode[];
};
