jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

import { apiClient } from '../client';
import { fetchFabricsList } from '../fabrics';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchFabricsList', () => {
  it('gets /api/v1/inventory/ with page_size, no search', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    const result = await fetchFabricsList();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/inventory/?page_size=200');
    expect(result).toEqual([]);
  });

  it('appends encoded search query when provided', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 1, results: [{ id: 'f1', name: 'Лён' }] });

    const result = await fetchFabricsList('лён');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/inventory/?page_size=200&search=%D0%BB%D1%91%D0%BD');
    expect(result).toEqual([{ id: 'f1', name: 'Лён' }]);
  });

  it('returns empty array when results is missing from response', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0 } as never);

    const result = await fetchFabricsList();

    expect(result).toEqual([]);
  });
});
