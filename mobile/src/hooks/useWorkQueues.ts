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

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const apiErr = err as ApiError;
    const status = typeof apiErr.status === 'number' ? apiErr.status : 0;
    const message = typeof apiErr.message === 'string' ? apiErr.message : 'Не удалось загрузить задачи.';
    if (status === 0) return 'Нет соединения. Потяните чтобы обновить.';
    return message;
  }
  if (err instanceof Error) {
    const isNetwork = err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('failed to fetch');
    return isNetwork ? 'Нет соединения. Потяните чтобы обновить.' : err.message;
  }
  return 'Не удалось загрузить задачи.';
}

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
      if (!fetcher) throw new Error(`No fetcher for role: ${role}`);
      const response = await fetcher();
      setData(response.items || []);
      setCount(response.count || 0);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return { data, count, loading, error, refetch: fetchQueue };
}
