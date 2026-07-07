jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { apiClient } from '../client';
import { fetchPayments, recordPayment } from '../payments';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchPayments', () => {
  it('gets /api/payments/', async () => {
    mockedApiClient.get.mockResolvedValueOnce([]);

    await fetchPayments();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/payments/');
  });
});

describe('recordPayment', () => {
  it('posts payment data to /api/payments/', async () => {
    mockedApiClient.post.mockResolvedValueOnce({
      id: '1', orderId: '1', orderNumber: 'О-2026-001', customerName: 'Иван', amount: 1000,
      type: 'prepayment', method: 'cash', status: 'received',
    });
    const data = { orderId: '1', amount: 1000, type: 'prepayment' as const, method: 'cash' as const };

    await recordPayment(data);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/payments/', data);
  });
});
