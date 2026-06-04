import { useState, useEffect, useCallback } from 'react';
import type { Order } from '../types/order';
import { fetchOrders } from '../api/orders';
import type { ApiError } from '../api/client';

function getErrorMessage(err: unknown): { message: string } {
  if (err && typeof err === 'object') {
    const apiErr = err as ApiError;
    const message = typeof apiErr.message === 'string' ? apiErr.message : 'Не удалось загрузить заказы.';
    return { message };
  }
  return { message: 'Не удалось загрузить заказы.' };
}

export function useOrders(statusFilter?: string) {
  const [data, setData] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchOrders(statusFilter);
      setData(page.results);
      setTotal(page.count);
    } catch (err) {
      const { message } = getErrorMessage(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, total, loading, error, refetch: fetch };
}
