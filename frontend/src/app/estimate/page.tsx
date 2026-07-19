"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import {
  ContextualNavigation,
  WorkflowNavPatterns,
  ErrorState,
  ResetConfirmationDialog,
  ResetDialogPresets,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useFabrics } from "@/hooks/useFabrics";
import { useCustomers } from "@/hooks/useCustomers";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { useOrder } from "@/hooks/useOrders";
import { ApiClientError } from "@/services/http/client";
import { useEstimateDraft } from "./hooks/useEstimateDraft";
import { useCreateQuote, type CreateQuoteInput } from "@/hooks/useQuotes";
import { fetchQuoteById, fetchQuotes } from "@/services/http/quotes";
import { shortOrderNumber } from "@/lib/order-number";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RoomSection,
  SummaryPanel,
} from "./components";
import { generateId } from "./utils/estimateHelpers";
import type { EstimateRoom, EstimateItem, QuoteDTO, MeasurementDTO } from "@/types";
import { Plus, Ruler, ArrowLeft, Calculator, Save, CheckCircle, Eye, FileSpreadsheet, AlertCircle } from "lucide-react";
import Link from "next/link";

/**
 * Estimate Page - Backend Integration Sprint
 *
 * Backend Status: 
 * - Quotes API: /api/quotes/ (DRF ViewSet)
 * - Quote Items API: /api/quote-items/
 * - Data persistence: Backend + localStorage backup
 *
 * Data Flow:
 * 1. User creates estimate in local draft (rooms/items)
 * 2. "Save to Quote" creates Quote + QuoteItems in backend
 * 3. After save: shows persisted state with quote number
 *
 * Sprint 10 Updates:
 * - Added quote creation via useCreateQuote hook
 * - Added item persistence via useAddQuoteItem hook
 * - Draft-to-Quote mapping with room_name preservation
 */

function EstimateContent() {
  const { data: fabricsData, isLoading: fabricsLoading, isError: fabricsError, error } = useFabrics();
  const fabrics = fabricsData?.results || [];
  
  // Fetch customers and tasks for selection
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: customersData } = useCustomers();
  const customers = customersData?.results || [];
  const createCustomer = useCreateCustomer();

  // Read customer and order from query params (order context for direct order flow)
  const customerFromQuery = searchParams.get("customer");
  const orderFromQuery = searchParams.get("order");

  // Draft state (localStorage-backed)
  const { project, setProject, resetDraft } = useEstimateDraft();
  const [showResetDialog, setShowResetDialog] = useState(false);
  
  // Backend integration state
  const [savedQuote, setSavedQuote] = useState<QuoteDTO | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerFromQuery || "");
  
  // New customer form state
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  
  // Load order data if opened from order context
  const {
    data: orderData,
    isLoading: isLoadingOrder,
    isError: isOrderError,
    error: orderError,
  } = useOrder(orderFromQuery);
  const [isPrefilled, setIsPrefilled] = useState(false);
  
  // Mutations
  const createQuote = useCreateQuote();

  useEffect(() => {
    if (!orderData || selectedCustomerId) return;
    const customerId = typeof orderData.customer === "object"
      ? orderData.customer.id
      : orderData.customer;
    if (customerId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs local selection once async orderData arrives, guarded by selectedCustomerId to run only once
      setSelectedCustomerId(customerId);
    }
  }, [orderData, selectedCustomerId]);
  
  // Derived state
  const isPersisted = !!savedQuote;
  // MVP: Only client is required - task is optional
  const canSave = project.rooms.length > 0 && 
                  project.rooms.some(r => r.items.length > 0) &&
                  selectedCustomerId;

  // Actions
  const addRoom = () => {
    const newRoom: EstimateRoom = {
      id: generateId(),
      name: `Комната ${project.rooms.length + 1}`,
      items: [],
    };
    setProject((prev) => ({ ...prev, rooms: [...prev.rooms, newRoom] }));
  };

  const updateRoom = (roomId: string, updates: Partial<EstimateRoom>) => {
    setProject((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r)),
    }));
  };

  const deleteRoom = (roomId: string) => {
    setProject((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((r) => r.id !== roomId),
    }));
  };

  /**
   * Helper: Map MeasurementDTO to EstimateItem
   */
  const measurementToEstimateItem = useCallback((measurement: MeasurementDTO): EstimateItem => {
    return {
      id: generateId(),
      window_name: measurement.window_name || "Окно",
      width_cm: measurement.width_cm || 0,
      height_cm: measurement.height_cm || 0,
      // Main fabric (curtain)
      curtain_fabric_id: measurement.curtain_fabric || null,
      curtain_fabric_meters: measurement.curtain_meters || 0,
      curtain_supply_mode: 'in_stock',
      // Tulle fabric
      tulle_fabric_id: measurement.tulle_fabric || null,
      tulle_fabric_meters: measurement.tulle_meters || 0,
      tulle_supply_mode: 'in_stock',
      // Sewing - empty, user fills in
      folds_count: 0,
      sewing_type: 'standard',
      complexity: 'medium',
      sewing_cost: 0,
      // Cornice - empty, user fills in
      cornice_length_m: 0,
      cornice_price_per_meter: 0,
      cornice_cost: 0,
      // Additional costs - empty, user fills in
      installation_price: 0,
      accessories_cost: 0,
      additional_services_total: 0,
    };
  }, []);

  /**
   * Helper: Group measurements by room and create EstimateRooms
   */
  const measurementsToEstimateRooms = useCallback((measurements: MeasurementDTO[]): EstimateRoom[] => {
    // Group by room_name
    const grouped = measurements.reduce((acc, measurement) => {
      const roomName = measurement.room_name || "Без комнаты";
      if (!acc[roomName]) {
        acc[roomName] = [];
      }
      acc[roomName].push(measurementToEstimateItem(measurement));
      return acc;
    }, {} as Record<string, EstimateItem[]>);

    // Create rooms from grouped items
    return Object.entries(grouped).map(([roomName, items], index) => ({
      id: generateId(),
      name: roomName,
      items: items,
    }));
  }, [measurementToEstimateItem]);

  /**
   * Prefill estimate from order measurements when order data loads
   */
  /* eslint-disable react-hooks/set-state-in-effect -- one-time prefill once async orderData arrives, guarded by isPrefilled */
  useEffect(() => {
    if (orderFromQuery && orderData && !isPrefilled) {
      const measurements = orderData.measurements || [];
      if (measurements.length > 0) {
        const rooms = measurementsToEstimateRooms(measurements);
        setProject((prev) => ({
          ...prev,
          rooms: rooms,
        }));
        setIsPrefilled(true);
      }
    }
  }, [orderFromQuery, orderData, isPrefilled, measurementsToEstimateRooms, setProject]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const addItemToRoom = (roomId: string) => {
    const room = project.rooms.find((r) => r.id === roomId);
    if (!room) return;

    const newItem: EstimateItem = {
      id: generateId(),
      window_name: `Позиция ${room.items.length + 1}`,
      width_cm: 0,
      height_cm: 0,
      // Main fabric
      curtain_fabric_id: null,
      curtain_fabric_meters: 0,
      curtain_supply_mode: 'in_stock',
      // Tulle fabric
      tulle_fabric_id: null,
      tulle_fabric_meters: 0,
      tulle_supply_mode: 'in_stock',
      // Sewing
      folds_count: 0,
      sewing_type: 'standard',
      complexity: 'medium',
      sewing_cost: 0,
      // Cornice
      cornice_length_m: 0,
      cornice_price_per_meter: 0,
      cornice_cost: 0,
      // Additional costs
      installation_price: 0,
      accessories_cost: 0,
      additional_services_total: 0,
    };

    setProject((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) =>
        r.id === roomId ? { ...r, items: [...r.items, newItem] } : r
      ),
    }));
  };

  const updateItem = (roomId: string, itemId: string, updates: Partial<EstimateItem>) => {
    setProject((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) =>
        r.id === roomId
          ? { ...r, items: r.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)) }
          : r
      ),
    }));
  };

  const deleteItem = (roomId: string, itemId: string) => {
    setProject((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) =>
        r.id === roomId ? { ...r, items: r.items.filter((i) => i.id !== itemId) } : r
      ),
    }));
  };

  /**
   * Save estimate draft as Quote in backend
   * Maps EstimateProject -> Quote, EstimateRoom/Item -> QuoteItem
   */
  const saveToQuote = async () => {
    if (!canSave) {
      alert("Нельзя сохранить: добавьте хотя бы одну комнату с позициями");
      return;
    }
    
    setIsSaving(true);
    try {
      // Calculate totals from draft
      let subtotal = 0;
      const quoteItems: CreateQuoteInput["items"] = [];
      
      // Phase 2: One EstimateItem = One QuoteItem
      project.rooms.forEach((room) => {
        room.items.forEach((item) => {
          const curtainFabric = fabrics.find((f) => f.id === item.curtain_fabric_id);
          const tulleFabric = fabrics.find((f) => f.id === item.tulle_fabric_id);

          // Calculate fabric costs
          const fabricCost = curtainFabric
            ? parseFloat(curtainFabric.price_per_meter) * item.curtain_fabric_meters
            : 0;
          const tulleCost = tulleFabric
            ? parseFloat(tulleFabric.price_per_meter) * item.tulle_fabric_meters
            : 0;

          // Calculate line_total (matches backend formula)
          const lineTotal =
            fabricCost +
            tulleCost +
            (item.sewing_cost || 0) +
            (item.cornice_cost || 0) +
            (item.installation_price || 0) +
            (item.accessories_cost || 0) +
            (item.additional_services_total || 0);

          // Create single QuoteItem with all components
          quoteItems.push({
            room_name: room.name,
            window_name: item.window_name,
            window_width_cm: item.width_cm,
            window_height_cm: item.height_cm,
            folds_count: item.folds_count || 0,
            // Main fabric
            fabric: item.curtain_fabric_id || null,
            fabric_meters: item.curtain_fabric_meters || 0,
            fabric_cost: fabricCost,
            // Tulle fabric (now part of same QuoteItem)
            tulle_fabric: item.tulle_fabric_id || null,
            tulle_meters: item.tulle_fabric_meters || 0,
            tulle_cost: tulleCost,
            // Supply mode (use curtain supply mode as primary)
            supply_mode: item.curtain_supply_mode || 'in_stock',
            // Sewing
            sewing_type: item.sewing_type || 'standard',
            complexity: item.complexity || 'medium',
            sewing_cost: item.sewing_cost || 0,
            // Cornice
            cornice_length_m: item.cornice_length_m || 0,
            cornice_cost: item.cornice_cost || 0,
            // Installation and additional services
            installation_price: item.installation_price || 0,
            accessories_cost: item.accessories_cost || 0,
            additional_services_total: item.additional_services_total || 0,
          });

          subtotal += lineTotal;
        });
      });
      
      if (quoteItems.length === 0) {
        alert("Нечего сохранять: выберите хотя бы одну ткань");
        return;
      }
      
      // Create Quote with items - MVP: task is optional
      // If orderFromQuery is present, link quote to existing order (direct order flow)
      const quoteData: CreateQuoteInput = {
        customer: selectedCustomerId,
        status: "draft",
        subtotal,
        discount_amount: 0,
        installation_cost: 0,
        delivery_cost: 0,
        prepayment_percent: 0.5,
        items: quoteItems,
        // Only include task if selected (Client -> Task -> Quote flow)
        // Otherwise allow direct Client -> Quote flow (MVP)
        // Link to existing order when creating from order context
        ...(orderFromQuery && { order: orderFromQuery }),
      };
      
      const quote = await createQuote.mutateAsync(quoteData);
      let savedQuoteData = quote;

      if (!savedQuoteData.id) {
        const latestQuotes = await fetchQuotes({
          customer: selectedCustomerId,
          ordering: "-created_at",
          page_size: 1,
        });
        const latestQuote = latestQuotes.results[0];
        if (latestQuote?.id) {
          savedQuoteData = await fetchQuoteById(latestQuote.id);
        }
      }

      setSavedQuote(savedQuoteData);
    } catch (err) {
      console.error("Ошибка сохранения:", err);
      alert(err instanceof Error ? err.message : "Не удалось создать КП");
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (fabricsLoading) {
    return (
      <>
        <PageHeader title="Конструктор смет" description="Создание смет с расчетом тканей">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Добавить комнату
          </Button>
        </PageHeader>
        <LoadingState message="Загрузка тканей со склада..." />
      </>
    );
  }

  // Error state
  if (fabricsError) {
    return (
      <>
        <PageHeader title="Конструктор смет" description="Создание смет с расчетом тканей">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Добавить комнату
          </Button>
        </PageHeader>

        <ErrorState
          title="Ошибка загрузки тканей"
          description={error?.message || "Не удалось загрузить склад. Попробуйте позже."}
          context={`Убедитесь, что бэкенд запущен: ${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"}`}
        />
      </>
    );
  }

  if (orderFromQuery && isLoadingOrder && project.rooms.length === 0) {
    return (
      <>
        <PageHeader title="Конструктор смет" description="Загрузка заказа и замеров">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Добавить комнату
          </Button>
        </PageHeader>
        <LoadingState message="Загрузка заказа для КП..." />
      </>
    );
  }

  if (orderFromQuery && isOrderError) {
    return (
      <>
        <PageHeader title="Конструктор смет" description="Не удалось загрузить заказ">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              К заказам
            </Link>
          </Button>
        </PageHeader>
        <ErrorState
          title="Ошибка загрузки заказа"
          description={orderError?.message || "Заказ не найден или недоступен"}
        />
      </>
    );
  }

  // Check if we have measurements from order
  const hasOrderMeasurements = orderFromQuery && orderData && (orderData.measurements?.length || 0) > 0;
  const measurementsCount = orderData?.measurements?.length || 0;

  // Empty estimate state - show different message if order has measurements
  if (project.rooms.length === 0) {
    return (
      <>
        <PageHeader title="Конструктор смет" description="Создание смет с расчетом тканей">
          <Button onClick={addRoom}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить комнату
          </Button>
        </PageHeader>

        <ContextualNavigation links={WorkflowNavPatterns.estimate()} />

        <div className="mt-6">
          {hasOrderMeasurements ? (
            // Show measurement-based empty state
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 mb-1">
                      КП из замеров
                    </h3>
                    <p className="text-amber-700 mb-3">
                      В заказе есть {measurementsCount} замеров. Позиции будут автоматически созданы из замеров при открытии конструктора.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={addRoom} variant="default" className="bg-amber-600 hover:bg-amber-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить комнату
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/orders/${orderFromQuery}`}>
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Вернуться к заказу
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : orderFromQuery && !hasOrderMeasurements ? (
            // Show warning if order has no measurements
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="h-6 w-6 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">
                      В заказе нет замеров
                    </h3>
                    <p className="text-slate-600 mb-3">
                      Сначала добавьте замеры или создайте позицию вручную.
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={addRoom} variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Добавить позицию вручную
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href={`/measurements?order=${orderFromQuery}`}>
                          <Ruler className="mr-2 h-4 w-4" />
                          Добавить замеры
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Default empty state
            <EmptyState
              title="Начните строить смету"
              description="Добавляйте комнаты и позиции для расчета стоимости тканей. Выбирайте ткани из склада с проверкой наличия."
              icon={<Ruler className="h-6 w-6 text-slate-600" />}
              action={{
                label: "Добавить первую комнату",
                onClick: addRoom,
              }}
            />
          )}
        </div>
      </>
    );
  }

  // Get customer name for display
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const customerName = selectedCustomer?.full_name || "Неизвестный клиент";

  // Working estimate screen
  return (
    <>
      <PageHeader
        title={isPersisted ? (savedQuote?.quote_number ? `КП ${savedQuote.quote_number}` : "КП сохранено") : "Конструктор смет"}
        description={
          isPersisted 
            ? `Сохранено на сервере • ${savedQuote?.items?.length || 0} позиций • Итого: ₸ ${savedQuote?.total?.toLocaleString() || 0}`
            : customerFromQuery && selectedCustomerId
              ? `Клиент: ${customerName} • ${project.rooms.length} комнат • ${fabrics.length} тканей`
              : `${project.rooms.length} комнат • ${fabrics.length} тканей доступно`
        }
      >
        <div className="flex items-center gap-2">
          {isPersisted ? (
            <>
              <Button variant="default" size="sm" asChild>
                <Link href={`/quotes/${savedQuote?.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Открыть КП
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/quotes">
                  <Calculator className="mr-2 h-4 w-4" />
                  Все КП
                </Link>
              </Button>
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="mr-1 h-3 w-3" />
                Сохранено
              </Badge>
            </>
          ) : (
            <Button 
              onClick={saveToQuote} 
              disabled={!canSave || isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Сохранение..." : "Сохранить как КП"}
            </Button>
          )}
          {customerFromQuery && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSelectedCustomerId("");
                router.push("/estimate");
              }}
            >
              Очистить клиента
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              К заказам
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/measurements">
              <Calculator className="mr-2 h-4 w-4" />
              Замеры
            </Link>
          </Button>
          <Button onClick={addRoom} disabled={isPersisted}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить комнату
          </Button>
        </div>
      </PageHeader>

      <ContextualNavigation links={WorkflowNavPatterns.estimate()} />

      {/* Measurement-based quote banner */}
      {isPrefilled && hasOrderMeasurements && (
        <Card className="bg-blue-50 border-blue-200 mb-5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">КП из замеров</h3>
                  <p className="text-sm text-blue-700">
                    Загружено: {measurementsCount} позиций из замеров заказа
                    {orderData?.order_number && ` ${shortOrderNumber(orderData.order_number)}`}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild className="border-blue-300 text-blue-700 hover:bg-blue-100">
                <Link href={`/orders/${orderFromQuery}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  К заказу
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isPersisted && orderFromQuery && (
        <Card className="bg-slate-50 border-slate-200 mb-5">
          <CardContent className="p-4 text-sm text-slate-600">
            КП создаётся из замеров заказа{orderData?.order_number ? ` ${shortOrderNumber(orderData.order_number)}` : ""}.
            Размеры, ткань, тюль и метры подтягиваются из замеров; цены, пошив, карниз, монтаж и доп. услуги заполняются здесь вручную.
            Тюль остаётся внутри той же позиции КП.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main working area */}
        <div className="lg:col-span-2 space-y-5">
          {/* Client Selection Card - Simplified UX */}
          <Card className="bg-[var(--card-sheber)] border-[var(--border-sheber)] shadow-[var(--sh)] rounded-[var(--rl)]">
            <CardContent className="p-4">
              {!showNewCustomerForm ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Клиент</Label>
                    {orderFromQuery && (
                      <span className="text-xs text-[var(--t3)]">
                        Привязка к заказу: {orderData?.order_number || "Заказ загружается"}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Select
                        value={selectedCustomerId}
                        onValueChange={setSelectedCustomerId}
                        disabled={isPersisted}
                      >
                        <SelectTrigger className="bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)] focus:ring-[var(--a)]/20 focus:border-[var(--a)] h-9 text-sm">
                          <SelectValue placeholder="Выберите клиента..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--card-sheber)] border-[var(--border-sheber)]">
                          {customers.length === 0 && (
                            <SelectItem value="__none__" disabled>Нет клиентов</SelectItem>
                          )}
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id} className="text-[var(--t1)] focus:bg-[var(--bg)]">
                              {customer.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {!isPersisted && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewCustomerForm(true)}
                        className="border-[var(--border-sheber)] text-[var(--a)] hover:bg-[var(--al)] whitespace-nowrap"
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Новый клиент
                      </Button>
                    )}
                  </div>
                  
                  {selectedCustomerId && (
                    <div className="mt-2 text-sm text-[var(--t2)]">
                      {customers.find(c => c.id === selectedCustomerId)?.phone}
                    </div>
                  )}
                  
                  {!isPersisted && !selectedCustomerId && (
                    <p className="text-xs text-[var(--warn)] mt-2 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--warn)]"></span>
                      Выберите клиента для сохранения КП
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-xs font-medium text-[var(--t2)] uppercase tracking-wide">Новый клиент</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewCustomerForm(false)}
                      className="text-[var(--t3)] h-auto py-1"
                    >
                      Отмена
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-[var(--t3)]">ФИО / Название</Label>
                      <Input
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="Иванов Иван"
                        className="h-8 text-sm bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-[var(--t3)]">Телефон</Label>
                      <Input
                        value={newCustomerPhone}
                        onChange={(e) => {
                          setNewCustomerPhone(e.target.value);
                          setPhoneError(null); // Clear error on change
                        }}
                        placeholder="+7 700 111 22 33"
                        className={`h-8 text-sm bg-[var(--input-bg)] border-[var(--border-sheber)] text-[var(--t1)] ${phoneError ? 'border-[var(--err)]' : ''}`}
                      />
                      {phoneError && (
                        <div className="text-xs text-[var(--err)] mt-1">
                          {phoneError}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {customerError && (
                    <div className="text-xs text-[var(--err)] mt-2">
                      {customerError}
                    </div>
                  )}

                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!newCustomerName.trim()) return;
                      
                      // Normalize phone: remove all non-digit characters
                      const normalizedPhone = newCustomerPhone.replace(/\D/g, "");
                      
                      // Validate phone: must be 10-20 digits
                      if (normalizedPhone.length > 0 && (normalizedPhone.length < 10 || normalizedPhone.length > 20)) {
                        setPhoneError("Телефон должен содержать 10–20 цифр");
                        return;
                      }
                      
                      setIsCreatingCustomer(true);
                      setCustomerError(null);
                      setPhoneError(null);
                      
                      try {
                        const newCustomer = await createCustomer.mutateAsync({
                          full_name: newCustomerName.trim(),
                          phone: normalizedPhone || "",
                        });
                        setSelectedCustomerId(newCustomer.id);
                        setShowNewCustomerForm(false);
                        setNewCustomerName("");
                        setNewCustomerPhone("");
                      } catch (err) {
                        console.error("Failed to create customer:", err);
                        const data = err instanceof ApiClientError
                          ? (err.data as { phone?: string[]; detail?: string } | undefined)
                          : undefined;
                        const errorMsg = data?.phone?.[0]
                          || data?.detail
                          || (err instanceof Error ? err.message : undefined)
                          || "Не удалось создать клиента";
                        // Check if it's a phone validation error from backend
                        if (data?.phone) {
                          setPhoneError(errorMsg);
                        } else {
                          setCustomerError(errorMsg);
                        }
                      } finally {
                        setIsCreatingCustomer(false);
                      }
                    }}
                    disabled={!newCustomerName.trim() || isCreatingCustomer}
                    className="mt-3 bg-[var(--a)] hover:bg-[var(--ad)] text-white"
                  >
                    {isCreatingCustomer ? "Создание..." : "Добавить клиента"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Room Sections */}
          <div className="space-y-5">
            {project.rooms.map((room) => (
              <RoomSection
                key={room.id}
                room={room}
                fabrics={fabrics}
                onUpdate={(updates) => updateRoom(room.id, updates)}
                onDelete={() => deleteRoom(room.id)}
                onAddItem={() => addItemToRoom(room.id)}
                onUpdateItem={(itemId, updates) => updateItem(room.id, itemId, updates)}
                onDeleteItem={(itemId) => deleteItem(room.id, itemId)}
              />
            ))}
          </div>
        </div>

        {/* Summary panel - Simplified */}
        <div className="lg:col-span-1 space-y-4">
          {!isPersisted && (
            <Button
              onClick={saveToQuote}
              disabled={!canSave || isSaving}
              className="w-full bg-[var(--a)] hover:bg-[var(--ad)] text-white h-12 text-base"
            >
              <Save className="mr-2 h-5 w-5" />
              {isSaving ? "Сохранение..." : "Сохранить КП"}
            </Button>
          )}
          <SummaryPanel
            rooms={project.rooms}
            fabrics={fabrics}
            onReset={() => setShowResetDialog(true)}
            isPersisted={isPersisted}
          />
        </div>
      </div>

      {/* Reset confirmation dialog - uses shared component */}
      <ResetConfirmationDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={() => {
          resetDraft();
          setShowResetDialog(false);
        }}
        {...ResetDialogPresets.estimate}
      />
    </>
  );
}

export default function EstimatePage() {
  return (
    <ProtectedRoute>
      <EstimateContent />
    </ProtectedRoute>
  );
}
