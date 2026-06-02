"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCompletionChecklist,
  changeOrderStatus,
  type CompletionChecklistDTO,
} from "@/services/http/orders";
import { useRole } from "@/hooks/useRole";
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function OrderCompletePage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();
  const { role } = useRole();

  const canAccess = role === "owner";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["order-completion-checklist", orderId],
    queryFn: () => getCompletionChecklist(orderId),
    enabled: !!orderId,
  });

  const completeMutation = useMutation({
    mutationFn: () => changeOrderStatus(orderId, { status: "completed" }),
    onSuccess: () => {
      alert("Заказ завершён");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push("/orders");
    },
    onError: (err: Error) => {
      alert(err.message || "Не удалось завершить заказ");
    },
  });

  if (!canAccess) {
    return (
      <>
        <PageHeader title="Завершение заказа" description="Доступ запрещён">
          <Button asChild variant="outline">
            <Link href={`/orders/${orderId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              К заказу
            </Link>
          </Button>
        </PageHeader>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">Доступ запрещён</p>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Завершение заказа" description="Загрузка..." />
        <LoadingState message="Загрузка чеклиста..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Завершение заказа" description="Ошибка загрузки">
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

  const checklist = data?.checklist || [];
  const canComplete = data?.can_complete || false;

  return (
    <>
      <PageHeader title="Завершение заказа" description="Проверьте выполнение всех условий">
        <Button asChild variant="outline">
          <Link href={`/orders/${orderId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            К заказу
          </Link>
        </Button>
      </PageHeader>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Чеклист завершения</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklist.map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              {item.done ? (
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400 shrink-0" />
              )}
              <span className={item.done ? "text-sm text-gray-900" : "text-sm text-gray-500"}>
                {item.label}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 text-center">
          <Button
            className="w-full"
            disabled={!canComplete || completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
          >
            {completeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Завершение...
              </>
            ) : (
              "Завершить заказ"
            )}
          </Button>
          {!canComplete && (
            <p className="text-sm text-muted-foreground mt-3">
              Выполните все пункты чеклиста, чтобы завершить заказ
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
