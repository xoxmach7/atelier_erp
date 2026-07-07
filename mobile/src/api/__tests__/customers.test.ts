jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
  },
}));

import { apiClient } from '../client';
import { fetchCustomers, fetchCustomer, createCustomer, updateCustomer, deleteCustomer } from '../customers';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchCustomers', () => {
  it('builds endpoint with page_size, no search', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchCustomers();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/customers/?page_size=200');
  });

  it('appends encoded search query when provided', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchCustomers('Иван Петров');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/customers/?page_size=200&search=%D0%98%D0%B2%D0%B0%D0%BD%20%D0%9F%D0%B5%D1%82%D1%80%D0%BE%D0%B2');
  });
});

describe('fetchCustomer', () => {
  it('gets /api/v1/customers/{id}/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ id: '1' });

    await fetchCustomer('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/customers/1/');
  });
});

describe('createCustomer', () => {
  it('posts input to /api/v1/customers/', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ id: '1' });
    const input = { full_name: 'Иван', phone: '+77001234567' };

    await createCustomer(input);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/customers/', input);
  });
});

describe('updateCustomer', () => {
  it('patches input to /api/v1/customers/{id}/', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({ id: '1' });

    await updateCustomer('1', { full_name: 'Пётр' });

    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/v1/customers/1/', { full_name: 'Пётр' });
  });
});

describe('deleteCustomer', () => {
  it('calls del on /api/v1/customers/{id}/', async () => {
    mockedApiClient.del.mockResolvedValueOnce({});

    await deleteCustomer('1');

    expect(mockedApiClient.del).toHaveBeenCalledWith('/api/v1/customers/1/');
  });
});
