"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateOrder } from "@/hooks/useOrders";
import { useCustomers } from "@/hooks/useCustomers";
import { ArrowLeft, Loader2, User, MapPin, Calendar, FileText } from "lucide-react";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Низкий" },
  { value: "normal", label: "Нормальный" },
  { value: "high", label: "Высокий" },
  { value: "urgent", label: "Срочный" },
];

// Wrapper component with Suspense
export default function NewOrderPage() {
  return (
    <Suspense fallback={<LoadingState message="Загрузка..." />}>
      <NewOrderContent />
    </Suspense>
  );
}

function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createOrder = useCreateOrder();
  const { data: customersData, isLoading: customersLoading } = useCustomers();

  // Prefill from query params (context from quote/measurement)
  const prefillCustomer = searchParams.get("customer");
  const prefillSource = searchParams.get("source");
  const prefillRef = searchParams.get("ref");

  const [formData, setFormData] = useState({
    customer: prefillCustomer || "",
    priority: "normal" as const,
    deadline_date: "",
    description: "",
    total_amount: "",
    pickup_address: "",
    delivery_address: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const customers = customersData?.results || [];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.customer) {
      newErrors.customer = "Выберите клиента";
    }
    if (formData.total_amount && isNaN(parseFloat(formData.total_amount))) {
      newErrors.total_amount = "Введите корректную сумму";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const result = await createOrder.mutateAsync({
        customer: formData.customer,
        priority: formData.priority,
        deadline_date: formData.deadline_date || null,
        description: formData.description,
        total_amount: formData.total_amount || undefined,
        pickup_address: formData.pickup_address,
        delivery_address: formData.delivery_address,
      });

      // Redirect to the created order detail
      router.push(`/orders/${result.id}`);
    } catch (err) {
      console.error("Failed to create order:", err);
    }
  };

  return (
    <>
      <PageHeader
        title="Новый заказ"
        description={
          prefillSource
            ? `Создание заказа ${prefillRef ? `из ${prefillRef}` : ""}`
            : "Создать новый заказ клиента"
        }
      >
        <Button asChild variant="outline">
          <Link href="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            ← К заказам
          </Link>
        </Button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Form Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Основная информация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer">
                Клиент <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.customer}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, customer: value }))
                }
                disabled={customersLoading}
              >
                <SelectTrigger className={errors.customer ? "border-red-500" : ""}>
                  <SelectValue
                    placeholder={
                      customersLoading ? "Загрузка клиентов..." : "Выберите клиента"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customer && (
                <p className="text-sm text-red-500">{errors.customer}</p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Приоритет</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: typeof formData.priority) =>
                  setFormData((prev) => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label htmlFor="deadline" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Срок выполнения
              </Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, deadline_date: e.target.value }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Addresses Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Адреса
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pickup_address">Адрес забора</Label>
              <Textarea
                id="pickup_address"
                placeholder="Введите адрес забора материалов/замеров"
                value={formData.pickup_address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, pickup_address: e.target.value }))
                }
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_address">Адрес доставки</Label>
              <Textarea
                id="delivery_address"
                placeholder="Введите адрес доставки готового изделия"
                value={formData.delivery_address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, delivery_address: e.target.value }))
                }
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Financial Card */}
        <Card>
          <CardHeader>
            <CardTitle>Финансовая информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="total_amount">Предварительная сумма (₸)</Label>
              <Input
                id="total_amount"
                type="number"
                placeholder="0"
                value={formData.total_amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, total_amount: e.target.value }))
                }
                className={errors.total_amount ? "border-red-500" : ""}
              />
              {errors.total_amount && (
                <p className="text-sm text-red-500">{errors.total_amount}</p>
              )}
              <p className="text-xs text-slate-500">
                Можно оставить пустым и заполнить позже
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Description Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Описание
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Описание заказа, особые пожелания клиента..."
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Context Info (if prefill) */}
        {prefillSource && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="text-sm text-blue-700">
                <strong>Контекст:</strong> Заказ создается на основе{" "}
                {prefillRef || prefillSource}. Клиент предзаполнен.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Submit Buttons */}
        <div className="flex items-center gap-4">
          <Button
            type="submit"
            size="lg"
            disabled={createOrder.isPending || customersLoading}
          >
            {createOrder.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Создание...
              </>
            ) : (
              "Создать заказ"
            )}
          </Button>
          <Button type="button" variant="outline" size="lg" asChild>
            <Link href="/orders">Отмена</Link>
          </Button>
        </div>

        {/* Error Display */}
        {createOrder.isError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">
              Ошибка создания заказа. Проверьте данные и попробуйте снова.
            </p>
          </div>
        )}
      </form>
    </>
  );
}
