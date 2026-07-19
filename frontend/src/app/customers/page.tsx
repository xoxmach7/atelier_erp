"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, Users, Mail } from "lucide-react";
import { maskPhoneInput } from "@/lib/phone";

/** Формат телефона → +7 (777) 777-77-77. Для нестандартных значений возвращает как есть. */
function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  if (d.length !== 11 || d[0] !== "7") return raw;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from "@/hooks/useCustomers";
import type { CustomerDTO, CreateCustomerInput, UpdateCustomerInput } from "@/hooks/useCustomers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalCloseX } from "@/components/shared/modal-close";

/* ------------------------------------------------------------------ */
/*  Customer Form (create / edit)                                     */
/* ------------------------------------------------------------------ */

interface CustomerFormProps {
  initial?: CustomerDTO | null;
  onSubmit: (data: CreateCustomerInput | UpdateCustomerInput) => void;
  isPending: boolean;
  onCancel: () => void;
  error?: string | null;
}

function CustomerForm({ initial, onSubmit, isPending, onCancel, error }: CustomerFormProps) {
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [phone, setPhone] = useState(maskPhoneInput(initial?.phone ?? ""));
  const [email, setEmail] = useState(initial?.email ?? "");

  const isValid = fullName.trim().length > 0 && phone.replace(/\D/g, "").length === 11;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSubmit({
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
    });
  }

  const inputClass =
    "w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[15px] text-[#0F172A] outline-none focus:border-[#0EA5E9] transition-colors placeholder:text-[#94A3B8]";

  return (
    <form onSubmit={handleSubmit} className="px-6 sm:px-[52px] pt-[72px] pb-10">
      <DialogHeader className="mb-8">
        <DialogTitle className="text-[28px] font-semibold text-[#0F172A]">
          {initial ? "Редактировать клиента" : "Добавление клиента"}
        </DialogTitle>
      </DialogHeader>

      <div className="mb-6">
        <label htmlFor="cust-name" className="block text-[15px] text-[#0F172A] mb-2">
          1. Фамилия и имя <span className="text-[#DC2626]">*</span>
        </label>
        <input
          id="cust-name"
          placeholder="Ахметов Данияр"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoFocus
          className={inputClass}
        />
      </div>

      <div className="mb-6">
        <label htmlFor="cust-phone" className="block text-[15px] text-[#0F172A] mb-2">
          2. Телефон <span className="text-[#DC2626]">*</span>
        </label>
        <input
          id="cust-phone"
          placeholder="+7 (777) 000-00-00"
          value={phone}
          onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
          inputMode="tel"
          className={inputClass}
        />
      </div>

      <div className="mb-8">
        <label htmlFor="cust-email" className="block text-[15px] text-[#0F172A] mb-2">Email</label>
        <input
          id="cust-email"
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-[#FEE2E2] border border-[#FECACA] px-4 py-3 text-[13px] text-[#DC2626]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || isPending}
        className="w-full rounded-[10px] bg-[#60CCED] py-3.5 text-[16px] font-medium text-white hover:bg-[#4DBCE0] transition-all disabled:opacity-60"
      >
        {isPending ? "Сохранение..." : initial ? "Сохранить" : "Создать"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function CustomersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDTO | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerDTO | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Data
  const { data, isLoading, error } = useCustomers(search || undefined);
  const customers = data?.results ?? [];

  // Mutations
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();

  /* handlers */

  function openCreate() {
    setEditingCustomer(null);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(c: CustomerDTO) {
    setEditingCustomer(c);
    setFormError(null);
    setDialogOpen(true);
  }

  function extractErrorMessage(err: unknown): string {
    return err instanceof Error && err.message ? err.message : "Не удалось сохранить клиента";
  }

  function handleFormSubmit(data: CreateCustomerInput | UpdateCustomerInput) {
    setFormError(null);
    if (editingCustomer) {
      updateMutation.mutate(
        { customerId: editingCustomer.id, data: data as UpdateCustomerInput },
        {
          onSuccess: () => setDialogOpen(false),
          onError: (err) => setFormError(extractErrorMessage(err)),
        }
      );
    } else {
      createMutation.mutate(data as CreateCustomerInput, {
        onSuccess: () => setDialogOpen(false),
        onError: (err) => setFormError(extractErrorMessage(err)),
      });
    }
  }

  function handleDelete() {
    if (!deletingCustomer) return;
    deleteMutation.mutate(deletingCustomer.id, {
      onSuccess: () => setDeletingCustomer(null),
    });
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#F0F4F8]">
        <div className="bg-white rounded-xl shadow-sm">
          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-[52px] py-5 sm:py-[30px]">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="text-[#475569] hover:text-[#0EA5E9] transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-[26px] font-semibold text-[#0F172A] whitespace-nowrap">
                Клиенты
              </h1>
              <button
                onClick={openCreate}
                className="ml-[48px] text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
              >
                Добавить клиента
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
                <Search size={14} className="text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Поиск по имени / телефону"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border-none bg-transparent text-[14px] text-[#0F172A] outline-none w-[200px] placeholder:text-[#94A3B8]"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="px-[52px] py-16">
              <LoadingState message="Загрузка клиентов..." />
            </div>
          ) : error ? (
            <div className="px-[52px] py-10">
              <ErrorState
                title="Ошибка загрузки клиентов"
                description={error.message}
              />
            </div>
          ) : customers.length === 0 ? (
            <div className="px-[52px] py-10">
              <EmptyState
                title={search ? "Клиенты не найдены" : "Нет клиентов"}
                description={search ? "Попробуйте изменить запрос" : "Добавьте первого клиента"}
                icon={<Users className="h-6 w-6 text-[#94A3B8]" />}
                action={!search ? { label: "Добавить клиента", onClick: openCreate } : undefined}
              />
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="bg-[#60CCED]">
                      <th className="px-[52px] py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Имя</th>
                      <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Телефон</th>
                      <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Email</th>
                      <th className="px-6 py-4 text-right text-[14px] font-medium text-white whitespace-nowrap pr-[52px]">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-dashed border-[#CBD5E1] hover:bg-[#F8FAFC] transition-colors"
                      >
                        <td className="px-[52px] py-4 text-[#0F172A]">
                          {c.full_name}
                        </td>
                        <td className="px-6 py-4 text-[#0F172A]">
                          {formatPhone(c.phone)}
                        </td>
                        <td className="px-6 py-4 text-[#475569]">
                          {c.email ? (
                            <span className="flex items-center gap-1.5">
                              <Mail size={13} className="text-[#94A3B8]" />
                              {c.email}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-4 pr-[52px]">
                          <div className="flex items-center justify-end gap-[20px]">
                            <button
                              onClick={() => openEdit(c)}
                              className="opacity-90 hover:opacity-100 transition-opacity"
                              title="Редактировать"
                            >
                              <img src="/icons/edit.png" width={22} height={22} alt="Редактировать" />
                            </button>
                            <button
                              onClick={() => setDeletingCustomer(c)}
                              className="opacity-90 hover:opacity-100 transition-opacity"
                              title="Удалить"
                            >
                              <img src="/icons/delete.png" width={22} height={22} alt="Удалить" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="border-t border-[#F1F5F9] px-[52px] py-3 text-[13px] text-[#94A3B8]">
                Всего: {data?.count ?? customers.length} клиентов
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[460px] p-0 gap-0 overflow-auto max-h-[90vh] [&>button]:hidden">
          <div><ModalCloseX onClose={() => setDialogOpen(false)} /></div>
          <CustomerForm
            initial={editingCustomer}
            onSubmit={handleFormSubmit}
            isPending={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setDialogOpen(false)}
            error={formError}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog
        open={!!deletingCustomer}
        onOpenChange={(open) => { if (!open) setDeletingCustomer(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить{" "}
              <span className="font-medium text-[#0F172A]">{deletingCustomer?.full_name}</span>?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white"
            >
              {deleteMutation.isPending ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}
