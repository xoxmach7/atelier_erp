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

function getErrorInfo(err: unknown): { message: string; isDemoEligible: boolean; isNetworkError: boolean } {
  if (err && typeof err === 'object') {
    const apiErr = err as ApiError;
    const status = typeof apiErr.status === 'number' ? apiErr.status : 0;
    const message = typeof apiErr.message === 'string' ? apiErr.message : 'Не удалось загрузить задачи.';
    const isNetworkError = status === 0;
    const isDemoEligible = status === 401;
    return { message: isNetworkError ? 'Нет соединения. Потяните чтобы обновить.' : message, isDemoEligible, isNetworkError };
  }
  if (err instanceof Error) {
    const isNetworkError = err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('failed to fetch');
    return { message: isNetworkError ? 'Нет соединения. Потяните чтобы обновить.' : err.message, isDemoEligible: false, isNetworkError };
  }
  return { message: 'Не удалось загрузить задачи.', isDemoEligible: false, isNetworkError: false };
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
      const { message, isDemoEligible, isNetworkError } = getErrorInfo(err);
      if (isNetworkError) {
        setError(message);
        setIsDemo(false);
      } else if (isDemoEligible) {
        const demo = DEMO_WORK_QUEUES[role];
        setData(demo?.items || []);
        setCount(demo?.count || 0);
        setIsDemo(true);
        setError(null);
      } else {
        setError(message);
        setIsDemo(false);
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
