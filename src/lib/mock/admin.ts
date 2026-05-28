import type { AdminUser } from "./types";

export const mockCurrentAdmin: AdminUser = {
  id: "admin-01",
  email: "admin@cookerloft.example",
  name: "Giulia Rossi",
  role: "admin",
};

export const mockAdmins: AdminUser[] = [
  mockCurrentAdmin,
  {
    id: "admin-02",
    email: "marco@cookerloft.example",
    name: "Marco Bianchi",
    role: "admin",
  },
];
