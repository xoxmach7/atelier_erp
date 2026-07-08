"use client";

import { useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchOrderById,
  getOrderPhotoReports,
  uploadOrderPhotoReport,
} from "@/services/http/orders";
import { useRole } from "@/hooks/useRole";
import { ArrowLeft, Camera, Loader2, Upload } from "lucide-react";
import Image from "next/image";

export default function OrderPhotosPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();
  const { role } = useRole();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = role === "installation" || role === "owner";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["order-photos", orderId],
    queryFn: () => getOrderPhotoReports(orderId),
    enabled: !!orderId,
  });

  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrderById(orderId),
    enabled: !!orderId,
  });

  const uploadBlockedReason =
    order?.status === "completed"
      ? "Заказ завершён — загрузка фотоотчёта недоступна"
      : order?.status === "cancelled"
        ? "Заказ отменён — загрузка фотоотчёта недоступна"
        : null;

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => uploadOrderPhotoReport(orderId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-photos", orderId] });
    },
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      Array.from(files).forEach((file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("caption", "");
        uploadMutation.mutate(formData);
      });

      e.target.value = "";
    },
    [uploadMutation]
  );

  if (isLoading) {
    return (
      <>
        <PageHeader title="Фотоотчёт" description="Загрузка..." />
        <LoadingState message="Загрузка фото..." />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Фотоотчёт" description="Ошибка загрузки">
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

  const photos = data?.photo_reports || [];

  return (
    <>
      <PageHeader title="Фотоотчёт" description={`${photos.length} фото`}>
        <Button asChild variant="outline">
          <Link href={`/orders/${orderId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            К заказу
          </Link>
        </Button>
      </PageHeader>

      {canUpload && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            {uploadBlockedReason ? (
              <p className="text-sm text-muted-foreground">{uploadBlockedReason}</p>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
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
                      Загрузить фото
                    </>
                  )}
                </Button>
                {uploadMutation.isError && (
                  <p className="text-sm text-red-600 mt-2">
                    {uploadMutation.error?.message === "Failed to fetch"
                      ? "Не удалось отправить фото. Проверьте соединение и размер файла, затем попробуйте ещё раз."
                      : uploadMutation.error?.message || "Ошибка загрузки"}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {photos.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Camera className="mx-auto h-8 w-8 mb-2" />
            <p>Фото ещё не загружены</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden">
              <div className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.file_url}
                  alt={photo.caption || "Фото"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {photo.caption && (
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground line-clamp-2">{photo.caption}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
