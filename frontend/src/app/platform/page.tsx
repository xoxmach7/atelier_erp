"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Copy, Check, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { ModalCloseX } from "@/components/shared/modal-close";
import { fetchAteliers, createAtelier } from "@/services/http/ateliers";
import type { AtelierCreatedDTO } from "@/types";

const EMPTY_FORM = {
  name: "",
  slug: "",
  owner_username: "",
  owner_first_name: "",
  owner_last_name: "",
  owner_email: "",
};

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString("ru-RU");
}

function PlatformContent() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Экран платформенного админа Sheber (управление ателье как клиентами) —
  // отдельная величина от "Owner ателье" (см. useRole().isOwner, которая
  // намеренно приравнивает is_superuser к Owner ради удобства внутри
  // конкретного ателье). Здесь проверяем ИМЕННО is_superuser напрямую.
  useEffect(() => {
    if (user && !user.is_superuser) router.replace("/orders");
  }, [user, router]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<AtelierCreatedDTO | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: ateliers, isLoading } = useQuery({
    queryKey: ["ateliers"],
    queryFn: fetchAteliers,
    staleTime: 30 * 1000,
    enabled: Boolean(user?.is_superuser),
  });

  const closeModal = () => {
    setModalOpen(false);
    setForm({ ...EMPTY_FORM });
    setFormError("");
  };

  const createMutation = useMutation({
    mutationFn: createAtelier,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ateliers"] });
      closeModal();
      setCreated(result);
      setCopied(false);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Не удалось создать ателье"),
  });

  const handleSubmit = () => {
    setFormError("");
    if (!form.name.trim()) return setFormError("Укажите название ателье");
    if (!form.owner_username.trim()) return setFormError("Укажите логин владельца");
    createMutation.mutate({
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      owner_username: form.owner_username.trim(),
      owner_first_name: form.owner_first_name.trim() || undefined,
      owner_last_name: form.owner_last_name.trim() || undefined,
      owner_email: form.owner_email.trim() || undefined,
    });
  };

  const inputCls =
    "w-full rounded-[10px] bg-[#E9E9E9] px-4 py-[14px] text-[15px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]";

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-[52px] py-5 sm:py-[30px]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/orders")}
              className="text-[#475569] hover:text-[#0EA5E9] transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[26px] font-semibold text-[#0F172A] whitespace-nowrap">Ателье</h1>
            <button
              onClick={() => setModalOpen(true)}
              className="ml-[48px] text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
            >
              Создать ателье
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#60CCED]">
                <th className="px-[52px] py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Название</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Slug</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Сотрудников</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Создано</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Статус</th>
                <th className="px-4 py-4 text-white w-12" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-[52px] py-10 text-center text-[#94A3B8]">Загрузка...</td></tr>
              ) : !ateliers || ateliers.length === 0 ? (
                <tr><td colSpan={6} className="px-[52px] py-10 text-center text-[#94A3B8]">Ателье не найдены</td></tr>
              ) : (
                ateliers.map((a) => (
                  <tr key={a.id} className="border-b border-dashed border-[#CBD5E1]">
                    <td className="px-[52px] py-4 text-[14px] text-[#0F172A]">{a.name}</td>
                    <td className="px-6 py-4 text-[14px] text-[#475569] whitespace-nowrap">{a.slug}</td>
                    <td className="px-6 py-4 text-[14px] text-[#475569] whitespace-nowrap">{a.employee_count}</td>
                    <td className="px-6 py-4 text-[14px] text-[#475569] whitespace-nowrap">{fmtDate(a.created_at)}</td>
                    <td className="px-6 py-4 text-[14px] whitespace-nowrap">
                      {a.is_active ? (
                        <span className="text-[#16A34A]">Активно</span>
                      ) : (
                        <span className="text-[#94A3B8]">Неактивно</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() =>
                          router.push(`/staff?tenant_id=${a.id}&name=${encodeURIComponent(a.name)}`)
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition-colors"
                        title="Сотрудники этого ателье"
                      >
                        <Users size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#F1F5F9] px-[52px] py-3 text-[13px] text-[#94A3B8]">
          Показано {ateliers?.length ?? 0} ателье
        </div>
      </div>

      {/* Создание ателье */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-6"
          style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !createMutation.isPending) closeModal(); }}
        >
          <div className="relative my-auto max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-[14px] bg-white shadow-2xl">
            <ModalCloseX onClose={() => !createMutation.isPending && closeModal()} />
            <div className="px-6 sm:px-[52px] pb-10 pt-[72px]">
              <h2 className="mb-8 text-[28px] font-semibold text-[#0F172A]">Новое ателье</h2>

              <div className="mb-6">
                <label className="block text-[15px] text-[#0F172A] mb-2">
                  1. Название <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                  className={inputCls}
                />
              </div>

              <div className="mb-6">
                <label className="block text-[15px] text-[#0F172A] mb-2">2. Slug (необязательно)</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="сгенерируется автоматически"
                  className={inputCls}
                />
              </div>

              <p className="mb-3 text-[13px] font-medium text-[#475569]">Первый сотрудник — владелец ателье</p>

              <div className="mb-6">
                <label className="block text-[15px] text-[#0F172A] mb-2">
                  3. Логин <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  value={form.owner_username}
                  onChange={(e) => setForm({ ...form, owner_username: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="mb-6 flex gap-3">
                <div className="flex-1">
                  <label className="block text-[15px] text-[#0F172A] mb-2">4. Имя</label>
                  <input
                    value={form.owner_first_name}
                    onChange={(e) => setForm({ ...form, owner_first_name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[15px] text-[#0F172A] mb-2">5. Фамилия</label>
                  <input
                    value={form.owner_last_name}
                    onChange={(e) => setForm({ ...form, owner_last_name: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-[15px] text-[#0F172A] mb-2">6. E-mail</label>
                <input
                  type="email"
                  value={form.owner_email}
                  onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
                  className={inputCls}
                />
              </div>

              {formError && <p className="mb-4 text-[14px] text-[#DC2626]">{formError}</p>}

              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !form.name.trim() || !form.owner_username.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#60CCED] py-[14px] text-[16px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Пароль владельца показывается один раз сразу после создания */}
      {created && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
        >
          <div className="relative w-full max-w-[420px] rounded-[14px] bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-[20px] font-semibold text-[#0F172A]">Ателье создано</h2>
            <p className="mb-5 text-[14px] text-[#94A3B8]">{created.name} · slug {created.slug}</p>
            <p className="mb-2 text-[13px] text-[#475569]">
              Владелец: <span className="font-medium text-[#0F172A]">{created.owner.username}</span>
            </p>
            <p className="mb-2 text-[13px] text-[#D97706] font-medium">
              Пароль показывается только сейчас — передайте его владельцу лично.
            </p>
            <div className="mb-5 flex items-center gap-2 rounded-[10px] bg-[#F1F5F9] px-4 py-3">
              <span className="flex-1 font-mono text-[16px] text-[#0F172A]">{created.owner.generated_password}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(created.owner.generated_password);
                  setCopied(true);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#475569] hover:bg-[#E2E8F0] transition-colors"
                title="Скопировать"
              >
                {copied ? <Check size={16} className="text-[#16A34A]" /> : <Copy size={16} />}
              </button>
            </div>
            <button
              onClick={() => setCreated(null)}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#60CCED] py-[12px] text-[15px] font-semibold text-white transition-colors hover:bg-[#4DBCE0]"
            >
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlatformPage() {
  return (
    <ProtectedRoute>
      <PlatformContent />
    </ProtectedRoute>
  );
}
