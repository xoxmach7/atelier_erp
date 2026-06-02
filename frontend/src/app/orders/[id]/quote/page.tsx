"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchQuotes,
  createQuote,
  generateQuotePdf,
  fetchMeasurements,
  type QuoteDTO,
  type QuoteItemPayload,
} from "@/services/http/orders";
import { useRole } from "@/hooks/useRole";
import { ArrowLeft, FileText, Loader2, Download } from "lucide-react";

interface QuoteFormItem {
  room_name: string;
  window_name: string;
  window_width_cm: number;
  window_height_cm: number;
  fabric_meters: string;
  fabric_cost: string;
  tulle_meters: string;
  tulle_cost: string;
  sewing_cost: string;
  installation_price: string;
  accessories_cost: string;
  line_total: string;
}

function fmtMoney(v: string | number | undefined): string {
  if (v === undefined || v === null) return "-";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function OrderQuotePage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();
  const { role } = useRole();

  const [showForm, setShowForm] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [installationCost, setInstallationCost] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [prepaymentPercent, setPrepaymentPercent] = useState("50");
  const [formItems, setFormItems] = useState<QuoteFormItem[]>([]);

  const canEdit = role === "owner" || role === "designer";

  const { data: quotesData, isLoading, isError, error } = useQuery({
    queryKey: ["order-quotes", orderId],
    queryFn: () => fetchQuotes(orderId),
    enabled: !!orderId,
  });

  const { data: measurementsData } = useQuery({
    queryKey: ["order-measurements-for-quote", orderId],
    queryFn: () => fetchMeasurements(orderId),
    enabled: showForm && !!orderId,
  });

  const createMutation = useMutation({
    mutationFn: createQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-quotes", orderId] });
      setShowForm(false);
    },
  });

  const pdfMutation = useMutation({
    mutationFn: generateQuotePdf,
    onSuccess: (data) => {
      if (data.pdf_url) {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
        window.open(`${baseUrl}${data.pdf_url}`, "_blank");
      }
      queryClient.invalidateQueries({ queryKey: ["order-quotes", orderId] });
    },
  });

  const initForm = () => {
    const mResults = measurementsData?.results || [];
    const items: QuoteFormItem[] = mResults.map((m) => ({
      room_name: m.room_name,
      window_name: m.window_name || "",
      window_width_cm: m.width_cm,
      window_height_cm: m.height_cm,
      fabric_meters: m.curtain_meters ? String(m.curtain_meters) : "",
      fabric_cost: "",
      tulle_meters: m.tulle_meters ? String(m.tulle_meters) : "",
      tulle_cost: "",
      sewing_cost: "",
      installation_price: "",
      accessories_cost: "",
      line_total: "",
    }));
    setFormItems(items);
    setShowForm(true);
  };

  const updateItem = (index: number, field: keyof QuoteFormItem, value: string) => {
    setFormItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      const item = next[index];
      const fabricCost = parseFloat(item.fabric_cost) || 0;
      const tulleCost = parseFloat(item.tulle_cost) || 0;
      const sewingCost = parseFloat(item.sewing_cost) || 0;
      const installPrice = parseFloat(item.installation_price) || 0;
      const accessoriesCost = parseFloat(item.accessories_cost) || 0;
      const total = fabricCost + tulleCost + sewingCost + installPrice + accessoriesCost;
      next[index].line_total = total > 0 ? String(total) : "";
      return next;
    });
  };

  const calculateGrandTotal = (): number => {
    const itemsTotal = formItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0);
    const install = parseFloat(installationCost) || 0;
    const delivery = parseFloat(deliveryCost) || 0;
    const discount = parseFloat(discountAmount) || 0;
    return itemsTotal + install + delivery - discount;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items: QuoteItemPayload[] = formItems.map((item) => ({
      room_name: item.room_name,
      window_name: item.window_name || undefined,
      window_width_cm: item.window_width_cm,
      window_height_cm: item.window_height_cm,
      fabric_meters: item.fabric_meters ? parseFloat(item.fabric_meters) : undefined,
      fabric_cost: item.fabric_cost ? parseFloat(item.fabric_cost) : undefined,
      tulle_meters: item.tulle_meters ? parseFloat(item.tulle_meters) : undefined,
      tulle_cost: item.tulle_cost ? parseFloat(item.tulle_cost) : undefined,
      sewing_cost: item.sewing_cost ? parseFloat(item.sewing_cost) : undefined,
      installation_price: item.installation_price ? parseFloat(item.installation_price) : undefined,
      accessories_cost: item.accessories_cost ? parseFloat(item.accessories_cost) : undefined,
      line_total: parseFloat(item.line_total) || 0,
    }));

    createMutation.mutate({
      order_id: orderId,
      items,
      valid_until: validUntil || undefined,
      discount_amount: discountAmount ? parseFloat(discountAmount) : undefined,
      installation_cost: installationCost ? parseFloat(installationCost) : undefined,
      delivery_cost: deliveryCost ? parseFloat(deliveryCost) : undefined,
      prepayment_percent: prepaymentPercent ? parseFloat(prepaymentPercent) / 100 : undefined,
    });
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Коммерческое предложение" description="Загрузка..." />
        <LoadingState message="Загрузка КП..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Коммерческое предложение" description="Ошибка загрузки">
          <Button asChild variant="outline">
            <Link href={`/orders/${orderId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              К заказу
            </Link>
          </Button>
        </PageHeader>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error?.message || "Ошибка загрузки"}</p>
        </div>
      </>
    );
  }

  const quotes = quotesData?.results || [];

  return (
    <>
      <PageHeader
        title="Коммерческое предложение"
        description={quotes.length > 0 ? `${quotes.length} КП` : "КП ещё не создано"}
      >
        <Button asChild variant="outline">
          <Link href={`/orders/${orderId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            К заказу
          </Link>
        </Button>
      </PageHeader>

      {!showForm && quotes.length === 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6 text-center text-slate-500">
            <p>КП ещё не создано</p>
            {canEdit && (
              <Button className="mt-4" onClick={initForm}>
                <FileText className="mr-2 h-4 w-4" />
                Создать КП
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!showForm && quotes.map((q) => (
        <Card key={q.id} className="mb-4">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>{q.quote_number}</span>
              <span className="text-sm font-normal text-slate-500">{q.status_label}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-slate-600">Клиент: {q.customer_name}</p>
            <p className="text-slate-600">Подытог: {fmtMoney(q.subtotal)} ₽</p>
            {parseFloat(q.discount_amount) > 0 && (
              <p className="text-slate-600">Скидка: -{fmtMoney(q.discount_amount)} ₽</p>
            )}
            {parseFloat(q.delivery_cost) > 0 && (
              <p className="text-slate-600">Доставка: +{fmtMoney(q.delivery_cost)} ₽</p>
            )}
            {parseFloat(q.installation_cost) > 0 && (
              <p className="text-slate-600">Монтаж: +{fmtMoney(q.installation_cost)} ₽</p>
            )}
            <p className="text-lg font-semibold">Итого: {fmtMoney(q.total)} ₽</p>
            <p className="text-slate-600">
              Предоплата ({Math.round(parseFloat(q.prepayment_percent) * 100)}%):{" "}
              {fmtMoney(parseFloat(q.total) * parseFloat(q.prepayment_percent))} ₽
            </p>

            {q.items.length > 0 && (
              <div className="mt-4 border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Комната</th>
                      <th className="px-3 py-2 text-left">Размеры</th>
                      <th className="px-3 py-2 text-right">Итого</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2">
                          {item.room_name}
                          {item.window_name ? ` — ${item.window_name}` : ""}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {item.window_width_cm}×{item.window_height_cm} см
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {fmtMoney(item.line_total)} ₽
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2 mt-4">
                <Button
                  variant={q.pdf_generated ? "outline" : "default"}
                  onClick={() => pdfMutation.mutate(q.id)}
                  disabled={pdfMutation.isPending}
                >
                  {pdfMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {q.pdf_generated ? "Перегенерировать PDF" : "Скачать PDF"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Новое коммерческое предложение</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {formItems.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-md space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">
                      {item.room_name}
                      {item.window_name ? ` — ${item.window_name}` : ""}
                    </h4>
                    <span className="text-sm text-slate-500">
                      {item.window_width_cm}×{item.window_height_cm} см
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Метраж ткани</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={item.fabric_meters}
                        onChange={(e) => updateItem(idx, "fabric_meters", e.target.value)}
                        placeholder="м"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Цена ткани</Label>
                      <Input
                        type="number"
                        value={item.fabric_cost}
                        onChange={(e) => updateItem(idx, "fabric_cost", e.target.value)}
                        placeholder="₽"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Метраж тюли</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={item.tulle_meters}
                        onChange={(e) => updateItem(idx, "tulle_meters", e.target.value)}
                        placeholder="м"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Цена тюли</Label>
                      <Input
                        type="number"
                        value={item.tulle_cost}
                        onChange={(e) => updateItem(idx, "tulle_cost", e.target.value)}
                        placeholder="₽"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Пошив</Label>
                      <Input
                        type="number"
                        value={item.sewing_cost}
                        onChange={(e) => updateItem(idx, "sewing_cost", e.target.value)}
                        placeholder="₽"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Монтаж</Label>
                      <Input
                        type="number"
                        value={item.installation_price}
                        onChange={(e) => updateItem(idx, "installation_price", e.target.value)}
                        placeholder="₽"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Аксессуары</Label>
                    <Input
                      type="number"
                      value={item.accessories_cost}
                      onChange={(e) => updateItem(idx, "accessories_cost", e.target.value)}
                      placeholder="₽"
                    />
                  </div>

                  <p className="text-sm font-medium">
                    Итого позиции: {fmtMoney(item.line_total)} ₽
                  </p>
                </div>
              ))}

              {formItems.length === 0 && measurementsData && (
                <div className="text-center text-slate-500 py-8">
                  Замеры не найдены. Добавьте замеры перед созданием КП.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Срок действия</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Предоплата (%)</Label>
                  <Input
                    type="number"
                    value={prepaymentPercent}
                    onChange={(e) => setPrepaymentPercent(e.target.value)}
                    placeholder="50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Скидка (₽)</Label>
                  <Input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Доставка (₽)</Label>
                  <Input
                    type="number"
                    value={deliveryCost}
                    onChange={(e) => setDeliveryCost(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Монтаж общий (₽)</Label>
                  <Input
                    type="number"
                    value={installationCost}
                    onChange={(e) => setInstallationCost(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-md">
                <span className="font-medium">Итоговая сумма:</span>
                <span className="text-xl font-semibold text-primary">
                  {fmtMoney(calculateGrandTotal())} ₽
                </span>
              </div>

              <div className="flex items-center gap-4">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    "Сохранить КП"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Отмена
                </Button>
              </div>

              {createMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
                  {createMutation.error?.message || "Ошибка сохранения"}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}
