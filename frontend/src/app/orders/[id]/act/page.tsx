"use client";

import { useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOrderCompletionAct,
  createOrderCompletionAct,
  uploadSignedCompletionAct,
} from "@/services/http/orders";
import { useRole } from "@/hooks/useRole";
import { ArrowLeft, FileText, Loader2, Upload, CheckCircle } from "lucide-react";

export default function OrderActPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();
  const { role } = useRole();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = role === "installation" || role === "owner";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["order-act", orderId],
    queryFn: () => getOrderCompletionAct(orderId),
    enabled: !!orderId,
  });

  const createMutation = useMutation({
    mutationFn: () => createOrderCompletionAct(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-act", orderId] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => uploadSignedCompletionAct(orderId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-act", orderId] });
    },
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("signed_file", file);
      formData.append("notes", "");
      uploadMutation.mutate(formData);
      e.target.value = "";
    },
    [uploadMutation]
  );

  if (isLoading) {
    return (
      <>
        <PageHeader title="АВР" description="Загрузка..." />
        <LoadingState message="Загрузка АВР..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="АВР" description="Ошибка загрузки">
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

  const act = data;
  const actData = act?.act;

  return (
    <>
      <PageHeader
        title="АВР"
        description={act?.exists ? actData?.act_number : "АВР ещё не создан"}
      >
        <Button asChild variant="outline">
          <Link href={`/orders/${orderId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            К заказу
          </Link>
        </Button>
      </PageHeader>

      {!act?.exists && act?.status === "not_available" && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="mx-auto h-8 w-8 mb-2" />
            <p>АВР недоступен</p>
            <p className="text-sm mt-1">{act?.message || "АВР доступен после установки / выдачи"}</p>
          </CardContent>
        </Card>
      )}

      {!act?.exists && act?.status === "not_created" && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground mb-6">
              <FileText className="mx-auto h-8 w-8 mb-2" />
              <p>АВР ещё не создан</p>
            </div>
            {canEdit && (
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Создание...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Создать АВР
                  </>
                )}
              </Button>
            )}
            {createMutation.isError && (
              <p className="text-sm text-red-600 mt-2 text-center">
                {createMutation.error?.message || "Ошибка создания"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {act?.exists && actData && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>{actData.act_number}</span>
                <Badge variant={actData.status === "signed" ? "default" : "secondary"}>
                  {actData.status_label}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {actData.notes && <p className="text-muted-foreground">{actData.notes}</p>}
              {actData.signed_at && (
                <p className="text-muted-foreground">
                  Подписан: {new Date(actData.signed_at).toLocaleDateString("ru-RU")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Подписанный АВР</CardTitle>
            </CardHeader>
            <CardContent>
              {actData.signed_file_url ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Файл загружен</span>
                  </div>
                  <a
                    href={actData.signed_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Открыть файл
                  </a>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p className="mb-4">Подписанный АВР не загружен</p>
                  {canEdit && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadMutation.isPending}
                      >
                        {uploadMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Загрузка...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Загрузить фото АВР
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  {uploadMutation.isError && (
                    <p className="text-sm text-red-600 mt-2">
                      {uploadMutation.error?.message || "Ошибка загрузки"}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
