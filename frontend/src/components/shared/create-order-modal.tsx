"use client";

import { useEffect, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalCloseX } from "./modal-close";
import { useCreateOrder } from "@/hooks/useOrders";
import { useStaff } from "@/hooks/useStaff";
import { useCustomers, useCreateCustomer } from "@/hooks/useCustomers";
import type { CustomerDTO } from "@/hooks/useCustomers";
import { maskPhoneInput } from "@/lib/phone";

/* ------------------------------------------------------------------ */
/*  Inline Customer Search/Select                                     */
/* ------------------------------------------------------------------ */

function CustomerSearch({
  value,
  onChange,
  onCreateNew,
}: {
  value: string;
  onChange: (id: string, name: string) => void;
  onCreateNew: () => void;
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  // value — имя уже выбранного клиента (например, только что созданного
  // через InlineNewCustomer). Раньше проп объявлялся в типе, но нигде не
  // читался — после инлайн-создания клиента поле поиска оставалось пустым,
  // хотя клиент реально выбирался (это показывала только мелкая зелёная
  // подпись под полем) — выглядело как "добавляет, но не выбирает".
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const { data, isLoading } = useCustomers(query || undefined);
  const customers = data?.results ?? [];

  function handleSelect(c: CustomerDTO) {
    onChange(c.id, c.full_name);
    setQuery(c.full_name);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Фамилия/телефон"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              if (!e.target.value) onChange("", "");
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] pl-10 pr-4 py-3 text-[15px] text-[#0F172A] outline-none focus:border-[#0EA5E9] transition-colors placeholder:text-[#94A3B8]"
          />
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="flex h-[46px] w-[46px] items-center justify-center rounded-[10px] bg-[#60CCED] text-white hover:bg-[#4DBCE0] transition-colors shrink-0"
          title="Новый клиент"
        >
          <UserPlus size={20} />
        </button>
      </div>

      {isOpen && query.length > 0 && (
        <div className="absolute left-0 right-12 top-full mt-1 z-50 max-h-[200px] overflow-y-auto rounded-[10px] border border-[#E2E8F0] bg-white shadow-lg">
          {isLoading ? (
            <div className="px-4 py-3 text-[14px] text-[#94A3B8]">Поиск...</div>
          ) : customers.length === 0 ? (
            <div className="px-4 py-3 text-[14px] text-[#94A3B8]">
              Не найдено.{" "}
              <button type="button" onClick={onCreateNew} className="text-[#0EA5E9] hover:underline">
                Создать нового
              </button>
            </div>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full text-left px-4 py-2.5 text-[14px] text-[#0F172A] hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9] last:border-0"
              >
                <span className="font-medium">{c.full_name}</span>
                {c.phone && <span className="text-[#94A3B8] ml-2">{c.phone}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline New Customer Mini-Form                                     */
/* ------------------------------------------------------------------ */

function InlineNewCustomer({
  onCreated,
  onCancel,
}: {
  onCreated: (c: CustomerDTO) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateCustomer();

  const isPhoneValid = phone.replace(/\D/g, "").length === 11;

  async function handleCreate() {
    if (!name.trim() || !isPhoneValid) return;
    setError(null);
    try {
      const customer = await createMutation.mutateAsync({
        full_name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      });
      onCreated(customer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать клиента");
    }
  }

  return (
    <div className="rounded-[10px] border border-[#60CCED] bg-[#F0F9FF] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-[#0F172A]">Новый клиент</span>
        <button type="button" onClick={onCancel} className="text-[#94A3B8] hover:text-[#475569]">
          <X size={16} />
        </button>
      </div>
      <input
        type="text"
        placeholder="Фамилия и имя *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-2.5 text-[14px] outline-none focus:border-[#0EA5E9]"
        autoFocus
      />
      <input
        type="text"
        placeholder="+7 (777) 000-00-00 *"
        value={phone}
        onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
        inputMode="tel"
        className="w-full rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-2.5 text-[14px] outline-none focus:border-[#0EA5E9]"
      />
      <input
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-2.5 text-[14px] outline-none focus:border-[#0EA5E9]"
      />
      {error && <p className="text-[13px] text-[#DC2626]">{error}</p>}
      <button
        type="button"
        onClick={handleCreate}
        disabled={!name.trim() || !isPhoneValid || createMutation.isPending}
        className="w-full rounded-[10px] bg-[#60CCED] py-2.5 text-[14px] font-medium text-white hover:bg-[#4DBCE0] transition-colors disabled:opacity-50"
      >
        {createMutation.isPending ? "Создание..." : "Добавить и выбрать"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Order Modal                                                 */
/* ------------------------------------------------------------------ */

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
  prefillCustomer?: string | null;
}

export function CreateOrderModal({ isOpen, onClose, onSuccess, prefillCustomer }: CreateOrderModalProps) {
  const createOrder = useCreateOrder();
  const { data: designers = [] } = useStaff("designer");

  // Свой номер заказа. Пусто — присвоит сервер (О-ГГГГ-NNN).
  const [orderNumber, setOrderNumber] = useState("");
  const [customerId, setCustomerId] = useState(prefillCustomer || "");
  const [customerName, setCustomerName] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [responsibleUserId, setResponsibleUserId] = useState<string>("");

  const [measurementDate, setMeasurementDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [apartment, setApartment] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Выберите клиента");
      return;
    }
    setError("");
    try {
      const result = await createOrder.mutateAsync({
        customer_id: customerId,
        order_number: orderNumber.trim() || undefined,
        responsible_user_id: responsibleUserId ? parseInt(responsibleUserId) : undefined,
        measurement_date: measurementDate || null,
        planned_completion: completionDate || null,
        installation_address_city: city,
        installation_address_street: street,
        installation_address_building: building,
        installation_address_apartment: apartment,
        installation_address_notes: notes,
        items: [],
      });
      onSuccess?.(result.id);
      onClose();
    } catch (err) {
      console.error("Create order failed:", err);
      setError(err instanceof Error ? err.message : "Ошибка создания заказа");
    }
  }

  function handleCustomerCreated(c: CustomerDTO) {
    setCustomerId(c.id);
    setCustomerName(c.full_name);
    setShowNewCustomer(false);
  }

  const inputClass =
    "w-full rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[15px] text-[#0F172A] outline-none focus:border-[#0EA5E9] transition-colors placeholder:text-[#94A3B8]";

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-auto max-h-[90vh] [&>button]:hidden">
        <div><ModalCloseX onClose={onClose} /></div>
        <form onSubmit={handleSubmit} className="px-[52px] pt-[72px] pb-10">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-[28px] font-semibold text-[#0F172A]">Создание заказа</DialogTitle>
          </DialogHeader>

          {/* 1. Номер заказа — ателье может вести нумерацию по-своему.
              Пусто — номер выдаст сервер (О-ГГГГ-NNN). */}
          <div className="mb-6">
            <label className="block text-[15px] text-[#0F172A] mb-2">1. Номер заказа</label>
            <input
              type="text"
              className={inputClass}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Оставьте пустым — присвоим автоматически"
            />
          </div>

          {/* 2. Клиент */}
          <div className="mb-6">
            <label className="block text-[15px] text-[#0F172A] mb-2">
              2. Клиент <span className="text-[#DC2626]">*</span>
            </label>
            {showNewCustomer ? (
              <InlineNewCustomer onCreated={handleCustomerCreated} onCancel={() => setShowNewCustomer(false)} />
            ) : (
              <CustomerSearch
                value={customerName}
                onChange={(id, name) => {
                  setCustomerId(id);
                  setCustomerName(name);
                }}
                onCreateNew={() => setShowNewCustomer(true)}
              />
            )}
          </div>

          {/* 3. Дизайнер */}
          <div className="mb-6">
            <label className="block text-[15px] text-[#0F172A] mb-2">3. Дизайнер</label>
            <div className="relative">
              <select
                className={`${inputClass} appearance-none pr-10`}
                value={responsibleUserId}
                onChange={(e) => setResponsibleUserId(e.target.value)}
              >
                <option value="">Не назначен</option>
                {designers.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.full_name}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </div>
          </div>

          {/* 3-4. Даты */}
          <div className="grid grid-cols-2 gap-[18px] mb-6">
            <div>
              <label className="block text-[15px] text-[#0F172A] mb-2">4. Дата замера</label>
              <input type="date" value={measurementDate} onChange={(e) => setMeasurementDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[15px] text-[#0F172A] mb-2">5. Завершение</label>
              <input type="date" value={completionDate} onChange={(e) => setCompletionDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* 6. Адрес установки */}
          <div className="mb-8">
            <label className="block text-[15px] text-[#0F172A] mb-2">6. Адрес установки</label>
            <div className="grid grid-cols-2 gap-[18px] mb-[18px]">
              <input type="text" placeholder="Город" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              <input type="text" placeholder="Улица" value={street} onChange={(e) => setStreet(e.target.value)} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-[18px] mb-[18px]">
              <input type="text" placeholder="Дом" value={building} onChange={(e) => setBuilding(e.target.value)} className={inputClass} />
              <input type="text" placeholder="Квартира" value={apartment} onChange={(e) => setApartment(e.target.value)} className={inputClass} />
            </div>
            <input type="text" placeholder="Примечание" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>

          {(error || createOrder.isError) && (
            <div className="mb-4 rounded-[10px] bg-[#FEE2E2] px-4 py-3 text-[14px] text-[#DC2626]">
              {error || (createOrder.error instanceof Error ? createOrder.error.message : "Ошибка")}
            </div>
          )}

          <button
            type="submit"
            disabled={createOrder.isPending}
            className="w-full rounded-[10px] bg-[#60CCED] py-3.5 text-[16px] font-medium text-white hover:bg-[#4DBCE0] transition-all disabled:opacity-60"
          >
            {createOrder.isPending ? "Создание..." : "Создать"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
