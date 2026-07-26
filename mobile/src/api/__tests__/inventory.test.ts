jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

import { apiClient } from '../client';
import { fetchInventoryItemById } from '../inventory';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchInventoryItemById', () => {
  it('запрашивает конкретную позицию по id', async () => {
    const item = { id: 'abc-123', name: 'Лён', sku: 'LEN-1' };
    mockedApiClient.get.mockResolvedValueOnce(item);

    const result = await fetchInventoryItemById('abc-123');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/inventory-items/abc-123/');
    expect(result).toEqual(item);
  });
});
