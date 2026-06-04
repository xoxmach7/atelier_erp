"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMaterials,
  updateMaterial,
  fetchOrderExecution,
  type OrderMaterialDTO,
} from "@/services/http/orders";
import { useRole } from "@/hooks/useRole";
import { ArrowLeft, Package, Loader2 } from "lucide-react";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  to_buy: "destructive",
  partial: "secondary",
  ready: "default",
};

const STATUS_LABELS: Record<string, string> = {
  to_buy: "Закупить",
  partial: "Частично",
  ready: "Готово",
};

export default function OrderMaterialsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();
  const { role } = useRole();

  const [selectedMaterial, setSelectedMaterial] = useState<OrderMaterialDTO | null>(null);
  const [dialogStatus, setDialogStatus] = useState("");
  const [dialogComment, setDialogComment] = useState("");

  const canEdit = role === "warehouse" || role === "owner";

  const { data: materialsData, isLoading: materialsLoading, isError: materialsError, error: materialsErr } = useQuery({
    queryKey: ["order-materials", orderId],
    queryFn: () => fetchMaterials(orderId),
    enabled: !!orderId,
  });

  const { data: orderData } = useQuery({
    queryKey: ["order-execution", orderId],
    queryFn: () => fetchOrderExecution(orderId),
    enabled: !!orderId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ materialId, payload }: { materialId: string; payload: { status: string; comment?: string } }) =>
      updateMaterial(orderId, materialId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-materials", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-execution", orderId] });
      setSelectedMaterial(null);
    },
  });

  const openDialog = (item: OrderMaterialDTO) => {
    if (!canEdit) return;
    setSelectedMaterial(item);
    setDialogStatus(item.status);
    setDialogComment(item.comment || "");
  };

  const handleSave = () => {
    if (!selectedMaterial) return;
    updateMutation.mutate({
      materialId: selectedMaterial.id,
      payload: { status: dialogStatus, comment: dialogComment },
    });
  };

  if (materialsLoading) {
    return (
      <>
        <PageHeader title="Материалы" description="Загрузка..." />
        <LoadingState message="Загрузка материалов..." />
      </>
    );
  }

  if (materialsError) {
    return (
      <>
        <PageHeader title="Материалы" description="Ошибка загрузки">
          <Button asChild variant="outline">
            <Link href={`/orders/${orderId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              К заказу
            </Link>
          </Button>
        </PageHeader>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{materialsErr?.message || "Ошибка загрузки"}</p>
        </div>
      </>
    );
  }

  const materials = materialsData?.results || [];
  const readinessLabel = orderData?.material_readiness_label || "";

  return (
    <>
      <PageHeader
        title="Материалы"
        description={materials.length > 0 ? `${materials.length} позиций` : "Материалы ещё не созданы"}
      >
        <Button asChild variant="outline">
          <Link href={`/orders/${orderId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            К заказу
          </Link>
        </Button>
      </PageHeader>

      {readinessLabel && (
        <Card className="mb-6 bg-primary/5">
          <CardContent className="pt-6 flex items-center gap-4">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Обеспеченность заказа</p>
              <p className="text-lg font-semibold">{readinessLabel}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {materials.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>Материалы ещё не созданы</p>
            <p className="text-sm mt-2">Появятся автоматически после перевода заказа в работу</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Название</th>
                <th className="px-4 py-3 text-left font-medium">Тип</th>
                <th className="px-4 py-3 text-right font-medium">Количество</th>
                <th className="px-4 py-3 text-left font-medium">Статус</th>
                {canEdit && <th className="px-4 py-3 text-left font-medium">Действие</th>}
              </tr>
            </thead>
            <tbody>
              {materials.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                  onClick={() => openDialog(item)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    {item.comment && (
                      <div className="text-xs text-muted-foreground mt-1">{item.comment}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{item.material_type}</td>
                  <td className="px-4 py-3 text-right">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[item.status] || "outline"}>
                      {STATUS_LABELS[item.status] || item.status_display}
                    </Badge>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDialog(item); }}>
                        Изменить
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selectedMaterial} onOpenChange={(open) => !open && setSelectedMaterial(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Статус материала</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{selectedMaterial?.name}</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Статус</label>
              <Select value={dialogStatus} onValueChange={setDialogStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="to_buy">🔴 Закупить</SelectItem>
                  <SelectItem value="partial">🟡 Частично</SelectItem>
                  <SelectItem value="ready">🟢 Готово</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Комментарий</label>
              <Textarea
                value={dialogComment}
                onChange={(e) => setDialogComment(e.target.value)}
                placeholder="Комментарий..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMaterial(null)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохранение...
                </>
              ) : (
                "Сохранить"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
