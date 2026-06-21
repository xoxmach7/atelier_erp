export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address_city?: string;
  address_street?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface CustomersPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Customer[];
}

export interface CustomerInput {
  full_name: string;
  phone: string;
  email?: string;
}
