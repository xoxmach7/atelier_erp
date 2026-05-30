import { useState, useEffect, useCallback } from 'react';
import type { Order, OrderDetail } from '../types/order';
import { fetchOrders, fetchOrderDetail } from '../api/orders';
import { DEMO_ORDERS, getDemoOrderDetail } from '../api/demoOrders';
import type { ApiError } from '../api/client';

function getErrorMessage(err: unknown): { message: string; status: number; isDemoEligible: boolean } {
  if (err && typeof err === 'object') {
    const apiErr = err as ApiError;
    const status = typeof apiErr.status === 'number' ? apiErr.status : 0;
    const message = typeof apiErr.message === 'string' ? apiErr.message : 'Не удалось загрузить заказы.';
    const isDemoEligible = status === 401 || status === 0;
    return { message, status, isDemoEligible };
  }
  return { message: 'Не удалось загрузить заказы.', status: 0, isDemoEligible: true };
}

export function useOrders(status?: string) {
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsDemo(false);
    try {
      const orders = await fetchOrders(status);
      setData(orders);
    } catch (err) {
      const { message, isDemoEligible } = getErrorMessage(err);
      if (isDemoEligible) {
        setData(DEMO_ORDERS);
        setIsDemo(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, isDemo, refetch: fetch };
}

export function useOrderDetail(id: string | null) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setIsDemo(false);
    try {
      if (id.startsWith('demo-')) {
        const demo = getDemoOrderDetail(id);
        if (demo) {
          setData(demo);
          setIsDemo(true);
          setLoading(false);
          return;
        }
      }
      const detail = await fetchOrderDetail(id);
      setData(detail);
    } catch (err) {
      const { message, isDemoEligible } = getErrorMessage(err);
      if (isDemoEligible) {
        const demo = getDemoOrderDetail(id);
        setData(demo ?? null);
        setIsDemo(!!demo);
        if (!demo) setError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, isDemo, refetch: fetch };
}
