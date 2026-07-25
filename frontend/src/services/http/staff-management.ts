import { get, post, patch, del } from "./client";
import type { StaffMemberDTO, StaffCreatedDTO, StaffCreateInput, StaffUpdateInput } from "@/types";

/** tenantId — только для платформенного админа, чтобы смотреть сотрудников конкретного ателье. */
export async function fetchStaffMembers(tenantId?: string): Promise<StaffMemberDTO[]> {
  return get<StaffMemberDTO[]>("/v1/staff-management/", { params: tenantId ? { tenant_id: tenantId } : undefined });
}

export async function createStaffMember(input: StaffCreateInput): Promise<StaffCreatedDTO> {
  return post<StaffCreatedDTO>("/v1/staff-management/", input);
}

export async function updateStaffMember(id: number, input: StaffUpdateInput): Promise<StaffMemberDTO> {
  return patch<StaffMemberDTO>(`/v1/staff-management/${id}/`, input);
}

export async function deactivateStaffMember(id: number): Promise<StaffMemberDTO> {
  return del<StaffMemberDTO>(`/v1/staff-management/${id}/`);
}
