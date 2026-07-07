jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

import { apiClient } from '../client';
import { fetchStaff } from '../staff';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchStaff', () => {
  it('gets /api/v1/staff/ without role filter', async () => {
    mockedApiClient.get.mockResolvedValueOnce([]);

    await fetchStaff();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/staff/');
  });

  it('appends encoded role query when provided', async () => {
    mockedApiClient.get.mockResolvedValueOnce([]);

    await fetchStaff('Seamstress');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/staff/?role=Seamstress');
  });
});
