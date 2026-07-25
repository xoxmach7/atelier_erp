import { get, post } from "./client";
import type { AtelierDTO, AtelierCreatedDTO, AtelierCreateInput } from "@/types";

export async function fetchAteliers(): Promise<AtelierDTO[]> {
  return get<AtelierDTO[]>("/v1/ateliers/");
}

export async function createAtelier(input: AtelierCreateInput): Promise<AtelierCreatedDTO> {
  return post<AtelierCreatedDTO>("/v1/ateliers/", input);
}
