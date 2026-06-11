import { useQuery } from "@tanstack/react-query";
import { get } from "@/services/http/client";

export interface StaffMember {
  id: number;
  username: string;
  full_name: string;
}

export function useStaff(role?: string) {
  const params = role ? `?role=${role}` : "";
  return useQuery<StaffMember[]>({
    queryKey: ["staff", role],
    queryFn: () => get<StaffMember[]>(`/api/v1/staff/${params}`),
    staleTime: 5 * 60 * 1000,
  });
}
