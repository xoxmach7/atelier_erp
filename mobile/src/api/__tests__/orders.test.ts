jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
    postMultipart: jest.fn(),
  },
}));

import { apiClient } from '../client';
import {
  createOrder, updateOrder, deleteOrder, fetchOrders, fetchOrderExecution,
  changeOrderStatus, changeMaterialReadiness, changeProductionStage, changeHandoverStage,
  cancelOrder, fetchMeasurements, createMeasurement, fetchQuotes, createQuote,
  generateQuotePdf, fetchMaterials, updateMaterial, fetchPhotoReports, uploadPhotoReport,
  fetchCompletionAct, createCompletionAct, uploadSignedAct, fetchCompletionChecklist,
} from '../orders';

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createOrder', () => {
  it('posts payload to /api/v1/orders/', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ id: '1' });

    const result = await createOrder({ client_name: 'Иван', client_phone: '+77001234567' });

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/', { client_name: 'Иван', client_phone: '+77001234567' });
    expect(result).toEqual({ id: '1' });
  });
});

describe('updateOrder', () => {
  it('patches payload to /api/v1/orders/{id}/', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({ id: '1', client_name: 'Пётр' });

    const result = await updateOrder('1', { client_name: 'Пётр' });

    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/v1/orders/1/', { client_name: 'Пётр' });
    expect(result).toEqual({ id: '1', client_name: 'Пётр' });
  });
});

describe('deleteOrder', () => {
  it('calls del on /api/v1/orders/{id}/', async () => {
    mockedApiClient.del.mockResolvedValueOnce({});

    await deleteOrder('1');

    expect(mockedApiClient.del).toHaveBeenCalledWith('/api/v1/orders/1/');
  });
});

describe('fetchOrders', () => {
  it('builds endpoint with page and page_size, no status filter', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchOrders();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/?page=1&page_size=50');
  });

  it('includes status filter and custom page when provided', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchOrders('in_work', 2);

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/?page=2&page_size=50&status=in_work');
  });
});

describe('fetchOrderExecution', () => {
  it('gets /api/v1/orders/{id}/execution/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ order_id: '1' });

    await fetchOrderExecution('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/execution/');
  });
});

describe('order status/stage actions', () => {
  it('changeOrderStatus posts {status} to change-status endpoint', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});

    await changeOrderStatus('1', 'in_work');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/change-status/', { status: 'in_work' });
  });

  it('changeMaterialReadiness posts {material_readiness}', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});

    await changeMaterialReadiness('1', 'ready');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/change-material-readiness/', { material_readiness: 'ready' });
  });

  it('changeProductionStage posts {production_stage}', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});

    await changeProductionStage('1', 'sewing');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/change-production-stage/', { production_stage: 'sewing' });
  });

  it('changeHandoverStage posts {handover_stage}', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});

    await changeHandoverStage('1', 'done');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/change-handover-stage/', { handover_stage: 'done' });
  });

  it('cancelOrder posts {reason}', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});

    await cancelOrder('1', 'Клиент отказался');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/cancel/', { reason: 'Клиент отказался' });
  });
});

describe('measurements', () => {
  it('fetchMeasurements gets /api/v1/orders/{orderId}/measurements/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchMeasurements('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/measurements/');
  });

  it('createMeasurement posts payload to measurements endpoint', async () => {
    mockedApiClient.post.mockResolvedValueOnce({});
    const payload = { room_name: 'Спальня', width: 150, height: 200 };

    await createMeasurement('1', payload);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/measurements/', payload);
  });
});

describe('quotes', () => {
  it('fetchQuotes gets /api/v1/quotes/ filtered by order', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchQuotes('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/quotes/?order=1');
  });

  it('createQuote posts payload to /api/v1/quotes/', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ id: 'q1' });
    const payload = { order_id: '1', items: [] };

    const result = await createQuote(payload);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/quotes/', payload);
    expect(result).toEqual({ id: 'q1' });
  });

  it('generateQuotePdf posts to generate-pdf endpoint', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ pdf_url: 'http://x/y.pdf', pdf_generated: true, path: '/y.pdf' });

    const result = await generateQuotePdf('q1');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/quotes/q1/generate-pdf/', {});
    expect(result.pdf_generated).toBe(true);
  });
});

describe('materials', () => {
  it('fetchMaterials gets /api/v1/orders/{orderId}/materials/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, results: [] });

    await fetchMaterials('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/materials/');
  });

  it('updateMaterial patches /api/v1/orders/{orderId}/materials/{materialId}/', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({
      material: { id: 'm1' },
      order_material_readiness: 'ready',
      order_material_readiness_label: 'Обеспечен',
    });

    await updateMaterial('1', 'm1', { status: 'ready' });

    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/v1/orders/1/materials/m1/', { status: 'ready' });
  });
});

describe('photo reports', () => {
  it('fetchPhotoReports gets /api/v1/orders/{orderId}/photo-reports/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ count: 0, photo_reports: [] });

    await fetchPhotoReports('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/photo-reports/');
  });

  it('uploadPhotoReport posts FormData via postMultipart', async () => {
    mockedApiClient.postMultipart.mockResolvedValueOnce({ id: 'p1' });
    const formData = new FormData();

    await uploadPhotoReport('1', formData);

    expect(mockedApiClient.postMultipart).toHaveBeenCalledWith('/api/v1/orders/1/photo-reports/', formData);
  });
});

describe('completion act', () => {
  it('fetchCompletionAct gets /api/v1/orders/{orderId}/completion-act/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ exists: false, status: 'not_created' });

    await fetchCompletionAct('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/completion-act/');
  });

  it('createCompletionAct posts empty body to completion-act endpoint', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ exists: true, status: 'draft' });

    await createCompletionAct('1');

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/v1/orders/1/completion-act/', {});
  });

  it('uploadSignedAct posts FormData via postMultipart', async () => {
    mockedApiClient.postMultipart.mockResolvedValueOnce({ act: undefined, created: true, message: 'ok' });
    const formData = new FormData();

    await uploadSignedAct('1', formData);

    expect(mockedApiClient.postMultipart).toHaveBeenCalledWith('/api/v1/orders/1/completion-act/upload-signed/', formData);
  });

  it('fetchCompletionChecklist gets /api/v1/orders/{orderId}/completion-checklist/', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ checklist: [], can_complete: false });

    await fetchCompletionChecklist('1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/orders/1/completion-checklist/');
  });
});
