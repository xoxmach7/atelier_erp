"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrder, useUpdateOrder } from "@/hooks/useOrders";
import { useRole } from "@/hooks/useRole";
import { ArrowLeft, Loader2, Save } from "lucide-react";

function getCustomerName(order: { customer: { full_name?: string } | string }): string {
  return typeof order.customer === "object" ? order.customer.full_name ?? "" : "";
}

function getCustomerPhone(order: { customer: { phone?: string } | string }): string {
  return typeof order.customer === "object" ? order.customer.phone ?? "" : "";
}

function getInstallationAddress(order: {
  installation_address_city: string;
  installation_address_street: string;
  installation_address_building: string;
  installation_address_apartment: string;
}): string {
  return [
    order.installation_address_city,
    order.installation_address_street,
    order.installation_address_building,
    order.installation_address_apartment,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { role } = useRole();

  const { data: order, isLoading: orderLoading } = useOrder(orderId);
  const updateOrder = useUpdateOrder();

  const [formData, setFormData] = useState({
    client_name: "",
    client_phone: "",
    address: "",
    deadline: "",
    comment: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill form when order data loads
  /* eslint-disable react-hooks/set-state-in-effect -- one-time prefill once async order data arrives */
  useEffect(() => {
    if (order) {
      setFormData({
        client_name: getCustomerName(order),
        client_phone: getCustomerPhone(order),
        address: getInstallationAddress(order),
        deadline: order.planned_completion ?? "",
        comment: order.notes ?? "",
      });
    }
  }, [order]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canEdit = role === "owner" || role === "designer";

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!formData.client_name.trim()) next.client_name = "Введите имя клиента";
    if (!formData.client_phone.trim()) next.client_phone = "Введите телефон";
    if (!formData.address.trim()) next.address = "Введите адрес";
    if (!formData.deadline.trim()) next.deadline = "Выберите срок";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!canEdit) return;

    try {
      await updateOrder.mutateAsync({
        orderId,
        data: {
          client_name: formData.client_name.trim(),
          client_phone: formData.client_phone.trim(),
          address: formData.address.trim(),
          deadline: formData.deadline,
          comment: formData.comment.trim() || undefined,
        },
      });
      router.push(`/orders/${orderId}`);
    } catch (err) {
      console.error("Failed to update order:", err);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  if (orderLoading) {
    return <LoadingState message="Загрузка заказа..." />;
  }

  if (!order) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Заказ не найден</p>
        <Link href="/orders" className="text-primary hover:underline mt-4 inline-block">
          ← Назад к заказам
        </Link>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Недостаточно прав для редактирования заказа</p>
        <Link href={`/orders/${orderId}`} className="text-primary hover:underline mt-4 inline-block">
          ← Назад к заказу
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <div className="mb-6">
        <Link href={`/orders/${orderId}`} className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1 mb-2">
          <ArrowLeft className="h-4 w-4" />
          Назад к заказу
        </Link>
        <PageHeader
          title="Редактировать заказ"
          description={order.order_number}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Информация о клиенте</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">
                  Имя клиента <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => updateField("client_name", e.target.value)}
                  placeholder="Иван Иванов"
                  className={errors.client_name ? "border-red-500" : ""}
                />
                {errors.client_name && (
                  <p className="text-sm text-red-500">{errors.client_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_phone">
                  Телефон <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="client_phone"
                  value={formData.client_phone}
                  onChange={(e) => updateField("client_phone", e.target.value)}
                  placeholder="+7 777 123 4567"
                  className={errors.client_phone ? "border-red-500" : ""}
                />
                {errors.client_phone && (
                  <p className="text-sm text-red-500">{errors.client_phone}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Адрес и сроки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">
                Адрес установки <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="г. Алматы, ул. Примерная, д. 12, кв. 45"
                className={errors.address ? "border-red-500" : ""}
              />
              {errors.address && (
                <p className="text-sm text-red-500">{errors.address}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">
                Срок выполнения <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => updateField("deadline", e.target.value)}
                className={errors.deadline ? "border-red-500" : ""}
              />
              {errors.deadline && (
                <p className="text-sm text-red-500">{errors.deadline}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Примечания</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comment">Комментарий</Label>
              <Textarea
                id="comment"
                value={formData.comment}
                onChange={(e) => updateField("comment", e.target.value)}
                placeholder="Дополнительные примечания к заказу..."
              />
            </div>
          </CardContent>
        </Card>

        {updateOrder.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">
              {updateOrder.error instanceof Error
                ? updateOrder.error.message
                : "Не удалось сохранить изменения"}
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={updateOrder.isPending}>
            {updateOrder.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Сохранить
          </Button>
          <Link href={`/orders/${orderId}`}>
            <Button variant="outline" type="button">
              Отмена
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
