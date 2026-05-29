import { useState, useEffect, useCallback } from 'react';
import type { RoleKey, WorkQueueResponse, WorkQueueItem } from '../types/work';
import {
  fetchOwnerQueue,
  fetchDesignerQueue,
  fetchQuotesQueue,
  fetchWarehouseQueue,
  fetchProductionQueue,
  fetchInstallationQueue,
} from '../api/work';

const fetchers: Record<RoleKey, () => Promise<WorkQueueResponse>> = {
  owner: fetchOwnerQueue,
  designer: fetchDesignerQueue,
  quotes: fetchQuotesQueue,
  warehouse: fetchWarehouseQueue,
  production: fetchProductionQueue,
  installation: fetchInstallationQueue,
  finance: fetchOwnerQueue,
};

export function useWorkQueue(role: RoleKey) {
  const [data, setData] = useState<WorkQueueItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetcher = fetchers[role];
      if (!fetcher) {
        throw new Error(`No fetcher for role: ${role}`);
      }
      const response = await fetcher();
      setData(response.items || []);
      setCount(response.count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return { data, count, loading, error, refetch: fetchQueue };
}
