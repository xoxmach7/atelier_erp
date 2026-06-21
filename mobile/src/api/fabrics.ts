import { apiClient } from './client';

export interface FabricLite {
  id: string;
  name: string;
  hanger_number?: string;
  available_meters?: string;
  price_per_meter?: string;
}
interface FabricsResponse { count: number; results: FabricLite[]; }

export async function fetchFabricsList(search?: string): Promise<FabricLite[]> {
  const q = search ? `&search=${encodeURIComponent(search)}` : '';
  const res = await apiClient.get<FabricsResponse>(`/api/v1/inventory/?page_size=200${q}`);
  return res.results ?? [];
}
