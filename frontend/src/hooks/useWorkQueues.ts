import { useQuery } from "@tanstack/react-query";
import {
  fetchDesignerQueue,
  fetchFinanceQueue,
  fetchInstallationQueue,
  fetchOwnerQueue,
  fetchProductionQueue,
  fetchQuotesQueue,
  fetchWarehouseQueue,
  fetchDashboard,
} from "@/services/http/work";

const WORK_QUEUES_QUERY_KEY = "work-queues";

export function useOwnerQueue(enabled = true) {
  return useQuery({
    queryKey: [WORK_QUEUES_QUERY_KEY, "owner"],
    queryFn: fetchOwnerQueue,
    staleTime: 30 * 1000,
    enabled,
  });
}

export function useDesignerQueue() {
  return useQuery({
    queryKey: [WORK_QUEUES_QUERY_KEY, "designer"],
    queryFn: fetchDesignerQueue,
    staleTime: 30 * 1000,
  });
}

export function useQuotesQueue() {
  return useQuery({
    queryKey: [WORK_QUEUES_QUERY_KEY, "quotes"],
    queryFn: fetchQuotesQueue,
    staleTime: 30 * 1000,
  });
}

export function useWarehouseQueue() {
  return useQuery({
    queryKey: [WORK_QUEUES_QUERY_KEY, "warehouse"],
    queryFn: fetchWarehouseQueue,
    staleTime: 30 * 1000,
  });
}

export function useProductionQueue() {
  return useQuery({
    queryKey: [WORK_QUEUES_QUERY_KEY, "production"],
    queryFn: fetchProductionQueue,
    staleTime: 30 * 1000,
  });
}

export function useInstallationQueue() {
  return useQuery({
    queryKey: [WORK_QUEUES_QUERY_KEY, "installation"],
    queryFn: fetchInstallationQueue,
    staleTime: 30 * 1000,
  });
}

export function useFinanceQueue() {
  return useQuery({
    queryKey: [WORK_QUEUES_QUERY_KEY, "finance"],
    queryFn: fetchFinanceQueue,
    staleTime: 30 * 1000,
  });
}

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: [WORK_QUEUES_QUERY_KEY, "dashboard"],
    queryFn: fetchDashboard,
    staleTime: 30 * 1000,
    enabled,
  });
}
