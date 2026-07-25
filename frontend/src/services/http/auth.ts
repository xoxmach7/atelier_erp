import { post } from "./client";

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await post<void>("/auth/change-password/", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
