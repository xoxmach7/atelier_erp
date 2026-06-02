export interface AddressObj {
  city?: string;
  street?: string;
  building?: string;
  apartment?: string;
}

export function formatAddress(
  address: string | AddressObj | null | undefined
): string {
  if (!address) return "";
  if (typeof address === "object") {
    return [address.city, address.street, address.building, address.apartment]
      .filter(Boolean)
      .join(", ");
  }
  return address;
}
