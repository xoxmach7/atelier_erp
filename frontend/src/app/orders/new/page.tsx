"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoadingState } from "@/components/shared/loading-state";
import { CreateOrderModal } from "@/components/shared/create-order-modal";

function NewOrderRoute() {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <CreateOrderModal
      isOpen
      onClose={() => router.push("/orders")}
      onSuccess={(id) => router.push(`/orders/${id}`)}
      prefillCustomer={searchParams.get("customer")}
    />
  );
}

export default function NewOrderPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<LoadingState message="Загрузка..." />}>
        <NewOrderRoute />
      </Suspense>
    </ProtectedRoute>
  );
}
