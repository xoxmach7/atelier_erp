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
    // Installation address
    installation_address_city: "",
    installation_address_street: "",
    installation_address_building: "",
    installation_address_apartment: "",
    installation_address_notes: "",
    // Dates
    measurement_date: "",
    planned_completion: "",
    // Notes
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const customers = customersData?.results || [];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.customer) {
      newErrors.customer = "Выберите клиента";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const result = await createOrder.mutateAsync({
        customer_id: formData.customer,
        // Installation address
        installation_address_city: formData.installation_address_city,
        installation_address_street: formData.installation_address_street,
        installation_address_building: formData.installation_address_building,
        installation_address_apartment: formData.installation_address_apartment,
        installation_address_notes: formData.installation_address_notes,
        // Dates
        measurement_date: formData.measurement_date || null,
        planned_completion: formData.planned_completion || null,
        // Notes
        notes: formData.notes,
        items: [], // Optional, but explicitly sent
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

            {/* Measurement Date */}
            <div className="space-y-2">
              <Label htmlFor="measurement_date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Дата замера
              </Label>
              <Input
                id="measurement_date"
                type="date"
                value={formData.measurement_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, measurement_date: e.target.value }))
                }
              />
            </div>

            {/* Planned Completion */}
            <div className="space-y-2">
              <Label htmlFor="planned_completion" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Плановое завершение
              </Label>
              <Input
                id="planned_completion"
                type="date"
                value={formData.planned_completion}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, planned_completion: e.target.value }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Installation Address Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Адрес установки
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="installation_address_city">Город</Label>
                <Input
                  id="installation_address_city"
                  placeholder="Алматы"
                  value={formData.installation_address_city}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, installation_address_city: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installation_address_street">Улица</Label>
                <Input
                  id="installation_address_street"
                  placeholder="ул. Примерная"
                  value={formData.installation_address_street}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, installation_address_street: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="installation_address_building">Дом</Label>
                <Input
                  id="installation_address_building"
                  placeholder="12"
                  value={formData.installation_address_building}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, installation_address_building: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="installation_address_apartment">Квартира</Label>
                <Input
                  id="installation_address_apartment"
                  placeholder="45"
                  value={formData.installation_address_apartment}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, installation_address_apartment: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="installation_address_notes">Примечания к адресу</Label>
              <Textarea
                id="installation_address_notes"
                placeholder="Подъезд, этаж, домофон..."
                value={formData.installation_address_notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, installation_address_notes: e.target.value }))
                }
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Примечания
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Описание заказа, особые пожелания клиента..."
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
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
            <p className="text-sm text-red-600 font-medium">
              Ошибка создания заказа
            </p>
            <div className="text-sm text-red-500 mt-1">
              {(() => {
                const err = createOrder.error;
                if (!err) return "Проверьте данные и попробуйте снова.";
                if (err instanceof Error) {
                  try {
                    const parsed = JSON.parse(err.message);
                    if (typeof parsed === 'object' && parsed !== null) {
                      return Object.entries(parsed).map(([field, messages]) => (
                        <div key={field}>
                          <strong>{field}:</strong> {Array.isArray(messages) ? messages.join(', ') : String(messages)}
                        </div>
                      ));
                    }
                  } catch {
                    // Not JSON, show raw message
                  }
                  return err.message;
                }
                return "Проверьте данные и попробуйте снова.";
              })()}
            </div>
          </div>
        )}
      </form>
    </>
  );
}
