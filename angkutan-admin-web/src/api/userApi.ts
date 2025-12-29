import apiClient, { authClient } from "./axiosConfig";

export type UserRole = "owner" | "admin" | "finance" | "inventory" | "operations" | "driver";

export interface User {
  id: number;
  username: string;
  role: UserRole;
  created_at?: string;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  role: Exclude<UserRole, "owner">; // owner is seeded / managed differently
}

export const fetchUsers = async (): Promise<User[]> => {
  // Use authClient so the base URL is /api, matching backend `/api/users`
  const response = await authClient.get<User[]>("/users");
  return response.data as unknown as User[];
};

export const createUser = async (payload: CreateUserPayload): Promise<User> => {
  const response = await authClient.post("/auth/register", payload);
  return response.data.user;
};


