"use client";

import { useEffect, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, MoreVertical, Copy, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { useRole } from "@/hooks/useRole";
import { ModalCloseX } from "@/components/shared/modal-close";
import {
  fetchStaffMembers,
  createStaffMember,
  updateStaffMember,
  deactivateStaffMember,
} from "@/services/http/staff-management";
import type { StaffMemberDTO, StaffCreatedDTO, StaffRole } from "@/types";

const ROLES: { value: StaffRole; label: string }[] = [
  { value: "Owner", label: "Владелец" },
  { value: "Designer", label: "Дизайнер/замерщик" },
  { value: "Warehouse", label: "Склад" },
  { value: "Seamstress", label: "Швейный цех" },
  { value: "Installer", label: "Монтажник" },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

const EMPTY_FORM = {
  username: "",
  first_name: "",
  last_name: "",
  email: "",
  role: "Designer" as StaffRole,
};

function StaffContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { isOwner } = useRole();
  const queryClient = useQueryClient();

  // Платформенный админ (is_superuser), открывший конкретное ателье с
  // экрана /platform, управляет ЕГО сотрудниками через ?tenant_id= — тот же
  // экран, что и у обычного Owner для своего ателье, чтобы не дублировать
  // всю форму/таблицу второй раз. Параметр значим только для реального
  // is_superuser — обычный Owner ателье не должен суметь подставить чужой
  // tenant_id в адресную строку и увидеть/менять сотрудников другого ателье.
  const tenantIdParam = searchParams.get("tenant_id") || undefined;
  const atelierNameParam = searchParams.get("name") || undefined;
  const isPlatformAdminView = Boolean(tenantIdParam) && Boolean(user?.is_superuser);

  useEffect(() => {
    if (!isOwner) {
      router.replace("/orders");
      return;
    }
    if (tenantIdParam && !user?.is_superuser) {
      router.replace("/orders");
    }
  }, [isOwner, router, tenantIdParam, user?.is_superuser]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState("");

  const [editingUser, setEditingUser] = useState<StaffMemberDTO | null>(null);
  const [editRole, setEditRole] = useState<StaffRole>("Designer");
  const [editError, setEditError] = useState("");

  const [createdStaff, setCreatedStaff] = useState<StaffCreatedDTO | null>(null);
  const [copied, setCopied] = useState(false);

  const [menu, setMenu] = useState<{ id: number; top: number; right: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const { data: staff, isLoading } = useQuery({
    queryKey: ["staff-management", tenantIdParam],
    queryFn: () => fetchStaffMembers(isPlatformAdminView ? tenantIdParam : undefined),
    staleTime: 30 * 1000,
    enabled: isOwner,
  });

  const closeModal = () => {
    setModalOpen(false);
    setForm({ ...EMPTY_FORM });
    setFormError("");
  };

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createStaffMember>[0]) =>
      createStaffMember(isPlatformAdminView ? { ...input, tenant_id: tenantIdParam } : input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["staff-management"] });
      closeModal();
      setCreatedStaff(created);
      setCopied(false);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Не удалось создать сотрудника"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { role?: StaffRole; is_active?: boolean } }) =>
      updateStaffMember(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-management"] });
      setEditingUser(null);
      setEditError("");
    },
    onError: (e: unknown) => setEditError(e instanceof Error ? e.message : "Не удалось сохранить"),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateStaffMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-management"] }),
  });

  const handleSubmit = () => {
    setFormError("");
    if (!form.username.trim()) return setFormError("Укажите логин");
    createMutation.mutate({
      username: form.username.trim(),
      role: form.role,
      first_name: form.first_name.trim() || undefined,
      last_name: form.last_name.trim() || undefined,
      email: form.email.trim() || undefined,
    });
  };

  const openEdit = (u: StaffMemberDTO) => {
    setMenu(null);
    setEditingUser(u);
    setEditRole(u.role ?? "Designer");
    setEditError("");
  };

  const handleSaveRole = () => {
    if (!editingUser) return;
    setEditError("");
    updateMutation.mutate({ id: editingUser.id, payload: { role: editRole } });
  };

  const handleToggleActive = (u: StaffMemberDTO) => {
    setMenu(null);
    if (u.is_active) {
      if (!confirm(`Деактивировать сотрудника «${u.full_name}»? Он не сможет войти в систему.`)) return;
      deactivateMutation.mutate(u.id);
    } else {
      updateMutation.mutate({ id: u.id, payload: { is_active: true } });
    }
  };

  const inputCls =
    "w-full rounded-[10px] bg-[#E9E9E9] px-4 py-[14px] text-[15px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]";
  const selectCls = `${inputCls} appearance-none pr-10`;

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-[52px] py-5 sm:py-[30px]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(isPlatformAdminView ? "/platform" : "/orders")}
              className="text-[#475569] hover:text-[#0EA5E9] transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[26px] font-semibold text-[#0F172A] whitespace-nowrap">
              {isPlatformAdminView ? `Сотрудники: ${atelierNameParam ?? ""}` : "Сотрудники"}
            </h1>
            <button
              onClick={() => setModalOpen(true)}
              className="ml-[48px] text-[15px] text-[#475569] hover:text-[#0EA5E9] transition-colors"
            >
              Добавить сотрудника
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#60CCED]">
                <th className="px-[52px] py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">ФИО</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Логин</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Роль</th>
                <th className="px-6 py-4 text-left text-[14px] font-medium text-white whitespace-nowrap">Статус</th>
                <th className="px-4 py-4 text-white w-12" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-[52px] py-10 text-center text-[#94A3B8]">Загрузка...</td></tr>
              ) : !staff || staff.length === 0 ? (
                <tr><td colSpan={5} className="px-[52px] py-10 text-center text-[#94A3B8]">Сотрудники не найдены</td></tr>
              ) : (
                staff.map((u) => (
                  <tr key={u.id} className="border-b border-dashed border-[#CBD5E1]">
                    <td className="px-[52px] py-4 text-[14px] text-[#0F172A]">{u.full_name}</td>
                    <td className="px-6 py-4 text-[14px] text-[#475569] whitespace-nowrap">{u.username}</td>
                    <td className="px-6 py-4 text-[14px] text-[#475569] whitespace-nowrap">
                      {u.role ? ROLE_LABEL[u.role] ?? u.role : "—"}
                    </td>
                    <td className="px-6 py-4 text-[14px] whitespace-nowrap">
                      {u.is_active ? (
                        <span className="text-[#16A34A]">Активен</span>
                      ) : (
                        <span className="text-[#94A3B8]">Деактивирован</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {u.id !== user?.id && (
                        <button
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenu((v) =>
                              v?.id === u.id
                                ? null
                                : { id: u.id, top: rect.bottom + 4, right: window.innerWidth - rect.right }
                            );
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569] transition-colors"
                          title="Действия"
                        >
                          <MoreVertical size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#F1F5F9] px-[52px] py-3 text-[13px] text-[#94A3B8]">
          Показано {staff?.length ?? 0} сотрудников
        </div>
      </div>

      {/* Меню действий строки — портал, как на «Материалах» (не обрезается overflow-x-auto). */}
      {menu && typeof document !== "undefined" && createPortal(
        (() => {
          const u = staff?.find((s) => s.id === menu.id);
          if (!u) return null;
          return (
            <>
              <div className="fixed inset-0 z-[100]" onClick={() => setMenu(null)} />
              <div
                className="fixed z-[101] w-52 rounded-[10px] bg-white py-1.5 shadow-2xl border border-[#E2E8F0]"
                style={{ top: menu.top, right: menu.right }}
              >
                <button
                  onClick={() => openEdit(u)}
                  className="w-full px-4 py-2.5 text-left text-[14px] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  Сменить роль
                </button>
                <button
                  onClick={() => handleToggleActive(u)}
                  className={`w-full px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-[#F1F5F9] ${
                    u.is_active ? "text-[#DC2626]" : "text-[#16A34A]"
                  }`}
                >
                  {u.is_active ? "Деактивировать" : "Восстановить"}
                </button>
              </div>
            </>
          );
        })(),
        document.body
      )}

      {/* Создание сотрудника */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-6"
          style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !createMutation.isPending) closeModal(); }}
        >
          <div className="relative my-auto max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-[14px] bg-white shadow-2xl">
            <ModalCloseX onClose={() => !createMutation.isPending && closeModal()} />
            <div className="px-6 sm:px-[52px] pb-10 pt-[72px]">
              <h2 className="mb-8 text-[28px] font-semibold text-[#0F172A]">Новый сотрудник</h2>

              <div className="mb-6">
                <label className="block text-[15px] text-[#0F172A] mb-2">
                  1. Логин <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  autoFocus
                  className={inputCls}
                />
              </div>

              <div className="mb-6 flex gap-3">
                <div className="flex-1">
                  <label className="block text-[15px] text-[#0F172A] mb-2">2. Имя</label>
                  <input
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[15px] text-[#0F172A] mb-2">3. Фамилия</label>
                  <input
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-[15px] text-[#0F172A] mb-2">4. E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="mb-8">
                <label className="block text-[15px] text-[#0F172A] mb-2">
                  5. Роль <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
                    className={selectCls}
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#475569]"
                    width="14" height="14" viewBox="0 0 24 24" fill="currentColor"
                  >
                    <path d="M12 16 6 9h12z" />
                  </svg>
                </div>
              </div>

              {formError && <p className="mb-4 text-[14px] text-[#DC2626]">{formError}</p>}

              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !form.username.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#60CCED] py-[14px] text-[16px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Пароль показывается один раз сразу после создания — второго способа его узнать нет. */}
      {createdStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
        >
          <div className="relative w-full max-w-[420px] rounded-[14px] bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-[20px] font-semibold text-[#0F172A]">Сотрудник создан</h2>
            <p className="mb-5 text-[14px] text-[#94A3B8]">
              {createdStaff.full_name} · {ROLE_LABEL[createdStaff.role ?? ""] ?? createdStaff.role}
            </p>
            <p className="mb-2 text-[13px] text-[#475569]">
              Логин: <span className="font-medium text-[#0F172A]">{createdStaff.username}</span>
            </p>
            <p className="mb-2 text-[13px] text-[#D97706] font-medium">
              Пароль показывается только сейчас — передайте его сотруднику лично.
            </p>
            <div className="mb-5 flex items-center gap-2 rounded-[10px] bg-[#F1F5F9] px-4 py-3">
              <span className="flex-1 font-mono text-[16px] text-[#0F172A]">{createdStaff.generated_password}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdStaff.generated_password);
                  setCopied(true);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#475569] hover:bg-[#E2E8F0] transition-colors"
                title="Скопировать"
              >
                {copied ? <Check size={16} className="text-[#16A34A]" /> : <Copy size={16} />}
              </button>
            </div>
            <button
              onClick={() => setCreatedStaff(null)}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#60CCED] py-[12px] text-[15px] font-semibold text-white transition-colors hover:bg-[#4DBCE0]"
            >
              Готово
            </button>
          </div>
        </div>
      )}

      {/* Смена роли */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(15,23,42,.35)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !updateMutation.isPending) setEditingUser(null); }}
        >
          <div className="relative w-full max-w-[380px] rounded-[14px] bg-white p-6 shadow-2xl">
            <h2 className="mb-1 text-[20px] font-semibold text-[#0F172A]">Сменить роль</h2>
            <p className="mb-5 text-[14px] text-[#94A3B8]">{editingUser.full_name}</p>
            <div className="relative mb-5">
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as StaffRole)}
                className={selectCls}
              >
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <svg
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#475569]"
                width="14" height="14" viewBox="0 0 24 24" fill="currentColor"
              >
                <path d="M12 16 6 9h12z" />
              </svg>
            </div>
            {editError && <p className="mb-4 text-[13px] text-[#DC2626]">{editError}</p>}
            <button
              onClick={handleSaveRole}
              disabled={updateMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#60CCED] py-[12px] text-[15px] font-semibold text-white transition-colors hover:bg-[#4DBCE0] disabled:opacity-50"
            >
              {updateMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StaffPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center"><div className="text-[#475569]">Загрузка...</div></div>}>
        <StaffContent />
      </Suspense>
    </ProtectedRoute>
  );
}
