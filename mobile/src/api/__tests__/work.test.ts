jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

import { apiClient } from '../client';
import {
  fetchOwnerQueue, fetchDesignerQueue, fetchQuotesQueue,
  fetchWarehouseQueue, fetchProductionQueue, fetchInstallationQueue, fetchFinanceQueue,
} from '../work';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

const emptyQueueResponse = { role: 'owner' as const, count: 0, items: [] };

describe('work queue fetchers', () => {
  it('fetchOwnerQueue gets /api/v1/work/owner/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchOwnerQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/owner/');
  });

  it('fetchDesignerQueue gets /api/v1/work/designer/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchDesignerQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/designer/');
  });

  it('fetchQuotesQueue gets /api/v1/work/quotes/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchQuotesQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/quotes/');
  });

  it('fetchWarehouseQueue gets /api/v1/work/warehouse/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchWarehouseQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/warehouse/');
  });

  it('fetchProductionQueue gets /api/v1/work/production/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchProductionQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/production/');
  });

  it('fetchInstallationQueue gets /api/v1/work/installation/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchInstallationQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/installation/');
  });

  it('fetchFinanceQueue gets /api/v1/work/finance/', async () => {
    mockedApiClient.get.mockResolvedValueOnce(emptyQueueResponse);
    await fetchFinanceQueue();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/work/finance/');
  });
});
