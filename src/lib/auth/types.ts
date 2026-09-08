export type Role = "farmer" | "lgu" | "admin";

export type AccountStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type AuthUser = {
  id: string;
  name: string;
  firstName: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
};
