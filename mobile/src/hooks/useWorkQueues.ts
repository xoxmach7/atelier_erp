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
import { DEMO_WORK_QUEUES } from '../api/demoWork';
import type { ApiError } from '../api/client';

const fetchers: Record<RoleKey, () => Promise<WorkQueueResponse>> = {
  owner: fetchOwnerQueue,
  designer: fetchDesignerQueue,
  quotes: fetchQuotesQueue,
  warehouse: fetchWarehouseQueue,
  production: fetchProductionQueue,
  installation: fetchInstallationQueue,
  finance: fetchOwnerQueue,
};

function getErrorInfo(err: unknown): { message: string; isDemoEligible: boolean } {
  if (err && typeof err === 'object') {
    const apiErr = err as ApiError;
    const status = typeof apiErr.status === 'number' ? apiErr.status : 0;
    const message = typeof apiErr.message === 'string' ? apiErr.message : 'Не удалось загрузить задачи.';
    return { message, isDemoEligible: status === 401 || status === 0 };
  }
  if (err instanceof Error) return { message: err.message, isDemoEligible: true };
  return { message: 'Не удалось загрузить задачи.', isDemoEligible: true };
}

export function useWorkQueue(role: RoleKey) {
  const [data, setData] = useState<WorkQueueItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsDemo(false);
    try {
      const fetcher = fetchers[role];
      if (!fetcher) {
        throw new Error(`No fetcher for role: ${role}`);
      }
      const response = await fetcher();
      setData(response.items || []);
      setCount(response.count || 0);
    } catch (err) {
      const { message, isDemoEligible } = getErrorInfo(err);
      if (isDemoEligible) {
        const demo = DEMO_WORK_QUEUES[role];
        setData(demo?.items || []);
        setCount(demo?.count || 0);
        setIsDemo(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return { data, count, loading, error, isDemo, refetch: fetchQueue };
}
