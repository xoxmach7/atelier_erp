import { apiClient } from './client';

export interface StaffUser {
  id: number;
  username: string;
  full_name: string;
}

export async function fetchStaff(role?: string): Promise<StaffUser[]> {
  const q = role ? `?role=${encodeURIComponent(role)}` : '';
  return apiClient.get<StaffUser[]>(`/api/v1/staff/${q}`);
}
