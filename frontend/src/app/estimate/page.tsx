"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import {
  ContextualNavigation,
  WorkflowNavPatterns,
  DraftStatusCard,
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
import { useTasks } from "@/hooks/useTasks";
import { useEstimateDraft } from "./hooks/useEstimateDraft";
import { useCreateQuote, type CreateQuoteInput } from "@/hooks/useQuotes";
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
  InventoryStatusCard,
} from "./components";
import { generateId } from "./utils/estimateHelpers";
import type { EstimateRoom, EstimateItem, QuoteDTO } from "@/types";
import { Plus, Ruler, ArrowLeft, Calculator, Save, CheckCircle, Eye } from "lucide-react";
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
  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers();
  const { data: tasksData, isLoading: isLoadingTasks } = useTasks();
  const customers = customersData?.results || [];
  const tasks = tasksData?.results || [];

  // Read customer from query params
  const customerFromQuery = searchParams.get("customer");

  // Draft state (localStorage-backed)
  const { project, setProject, resetDraft } = useEstimateDraft();
  const [showResetDialog, setShowResetDialog] = useState(false);
  
  // Backend integration state
  const [savedQuote, setSavedQuote] = useState<QuoteDTO | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerFromQuery || "");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  
  // Mutations
  const createQuote = useCreateQuote();
  
  // Derived state
  const isPersisted = !!savedQuote;
  const canSave = project.rooms.length > 0 && 
                  project.rooms.some(r => r.items.length > 0) &&
                  selectedCustomerId && 
                  selectedTaskId;

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

  const addItemToRoom = (roomId: string) => {
    const room = project.rooms.find((r) => r.id === roomId);
    if (!room) return;

    const newItem: EstimateItem = {
      id: generateId(),
      name: `Позиция ${room.items.length + 1}`,
      width_cm: 0,
      height_cm: 0,
      curtain_fabric_id: null,
      curtain_fabric_meters: 0,
      tulle_fabric_id: null,
      tulle_fabric_meters: 0,
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
      
      // Map draft rooms/items to QuoteItems
      project.rooms.forEach((room) => {
        room.items.forEach((item) => {
          const curtainFabric = fabrics.find((f) => f.id === item.curtain_fabric_id);
          const tulleFabric = fabrics.find((f) => f.id === item.tulle_fabric_id);
          
          // Calculate costs
          const fabricCost = curtainFabric 
            ? parseFloat(curtainFabric.price_per_meter) * item.curtain_fabric_meters 
            : 0;
          const tulleCost = tulleFabric 
            ? parseFloat(tulleFabric.price_per_meter) * item.tulle_fabric_meters 
            : 0;
          
          // Create QuoteItem for curtain (if fabric selected)
          if (item.curtain_fabric_id && item.curtain_fabric_meters > 0) {
            quoteItems.push({
              room_name: room.name,
              window_width_cm: item.width_cm,
              window_height_cm: item.height_cm,
              folds_count: 0,
              fabric: item.curtain_fabric_id,
              fabric_meters: item.curtain_fabric_meters,
              fabric_cost: fabricCost,
              sewing_type: "standard",
              complexity: "medium",
              sewing_cost: 0,
              accessories_cost: 0,
              cornice: null,
              cornice_cost: 0,
            });
            subtotal += fabricCost;
          }
          
          // Create QuoteItem for tulle (if fabric selected) - separate line item
          if (item.tulle_fabric_id && item.tulle_fabric_meters > 0) {
            quoteItems.push({
              room_name: `${room.name} (Tulle)`,
              window_width_cm: item.width_cm,
              window_height_cm: item.height_cm,
              folds_count: 0,
              fabric: item.tulle_fabric_id,
              fabric_meters: item.tulle_fabric_meters,
              fabric_cost: tulleCost,
              sewing_type: "standard",
              complexity: "medium",
              sewing_cost: 0,
              accessories_cost: 0,
              cornice: null,
              cornice_cost: 0,
            });
            subtotal += tulleCost;
          }
        });
      });
      
      if (quoteItems.length === 0) {
        alert("Нечего сохранять: выберите хотя бы одну ткань");
        return;
      }
      
      // Create Quote with items - using REAL customer and task IDs
      const quoteData: CreateQuoteInput = {
        task: selectedTaskId,
        customer: selectedCustomerId,
        status: "draft",
        subtotal,
        discount_amount: 0,
        installation_cost: 0,
        delivery_cost: 0,
        prepayment_percent: 0.5,
        items: quoteItems,
      };
      
      const quote = await createQuote.mutateAsync(quoteData);
      setSavedQuote(quote);
      
      console.log(`КП ${quote.quote_number} создано с ${quoteItems.length} позициями`);
      
      // Clear local draft after successful save
      resetDraft();
      
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

  // Empty estimate state
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
        <DraftStatusCard draftType="estimate" hasContent={false} />

        <div className="mt-6">
          <EmptyState
            title="Начните строить смету"
            description="Добавляйте комнаты и позиции для расчета стоимости тканей. Выбирайте ткани из склада с проверкой наличия."
            icon={<Ruler className="h-6 w-6 text-slate-600" />}
            action={{
              label: "Добавить первую комнату",
              onClick: addRoom,
            }}
          />
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
        title={isPersisted ? `КП ${savedQuote?.quote_number}` : "Конструктор смет"}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main working area */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-50 border-dashed">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Выберите задачу *</Label>
                  <Select 
                    value={selectedTaskId} 
                    onValueChange={setSelectedTaskId}
                    disabled={isPersisted}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите задачу..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tasks.length === 0 && (
                        <SelectItem value="__none__" disabled>Нет доступных задач</SelectItem>
                      )}
                      {tasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.task_number} - {task.client_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Выберите клиента *</Label>
                  <Select 
                    value={selectedCustomerId} 
                    onValueChange={setSelectedCustomerId}
                    disabled={isPersisted}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите клиента..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.length === 0 && (
                        <SelectItem value="__none__" disabled>Нет доступных клиентов</SelectItem>
                      )}
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.full_name} {customer.phone && `(${customer.phone})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!isPersisted && (!selectedTaskId || !selectedCustomerId) && (
                <p className="text-xs text-amber-600 mt-2">
                  * Обязательно для сохранения КП
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
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

        {/* Summary panel */}
        <div className="lg:col-span-1 space-y-4">
          <DraftStatusCard draftType="estimate" hasContent={true} />
          <SummaryPanel
            rooms={project.rooms}
            fabrics={fabrics}
            onReset={() => setShowResetDialog(true)}
          />
          <InventoryStatusCard fabricsCount={fabrics.length} />
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
