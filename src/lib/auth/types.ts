export type Role = "farmer" | "lgu" | "admin";

export type AccountStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type AuthUser = {
  id: string;
  name: string;
  firstName: string;
  email: string;
  /** Empty when not answered. */
  gender?: "MALE" | "FEMALE" | "UNDISCLOSED" | "";
  role: Role;
  accountStatus: AccountStatus;
};
