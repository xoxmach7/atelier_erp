/**
 * Форма URL у http-сервисов.
 *
 * Ловит механическую опечатку, из-за которой ломались реальные экраны:
 * константа эндпоинта уже оканчивается на "/", а вызов клеил `${BASE}/${id}/`
 * — получалось `/v1/measurements//{id}/`. Django такой маршрут не знает и
 * отдаёт HTML-страницу 404, поэтому в интерфейсе вылезал алерт "Not Found"
 * вместо понятной ошибки. Тем же способом были сломаны платёж по id и
 * добавление позиции в КП.
 *
 * Проверяем не текст конкретного пути, а инвариант: путь, с которым сервис
 * зовёт http-клиент, не содержит "//" и начинается с "/v1/". Так тест
 * переживёт переименование эндпоинтов, но не переживёт возврат опечатки.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = (path: string, ...rest: unknown[]) => Promise<unknown>;

const get = vi.fn<Call>(() => Promise.resolve({}));
const post = vi.fn<Call>(() => Promise.resolve({}));
const patch = vi.fn<Call>(() => Promise.resolve({}));
const del = vi.fn<Call>(() => Promise.resolve(undefined));

vi.mock("./client", () => ({
  get: (path: string, ...rest: unknown[]) => get(path, ...rest),
  post: (path: string, ...rest: unknown[]) => post(path, ...rest),
  patch: (path: string, ...rest: unknown[]) => patch(path, ...rest),
  del: (path: string, ...rest: unknown[]) => del(path, ...rest),
}));

import * as measurements from "./measurements";
import * as payments from "./payments";
import * as quotes from "./quotes";
import * as tasks from "./tasks";
import * as staffManagement from "./staff-management";
import * as ateliers from "./ateliers";

const ID = "11111111-2222-3333-4444-555555555555";

/** Все пути, с которыми сервисы обратились к клиенту за время вызова. */
function calledPaths(): string[] {
  return [get, post, patch, del]
    .flatMap((m) => m.mock.calls as unknown as unknown[][])
    .map((args) => args[0])
    .filter((p): p is string => typeof p === "string");
}

/** Сценарии: [имя, вызов сервиса]. */
const CASES: [string, () => Promise<unknown>][] = [
  ["measurements.fetchMeasurements", () => measurements.fetchMeasurements()],
  ["measurements.fetchMeasurementById", () => measurements.fetchMeasurementById(ID)],
  ["measurements.updateMeasurement", () => measurements.updateMeasurement(ID, { quantity: 2 })],
  ["measurements.deleteMeasurement", () => measurements.deleteMeasurement(ID)],
  ["payments.fetchPayments", () => payments.fetchPayments()],
  ["payments.fetchPaymentById", () => payments.fetchPaymentById(ID)],
  ["payments.deletePayment", () => payments.deletePayment(ID)],
  ["quotes.fetchQuoteById", () => quotes.fetchQuoteById(ID)],
  ["quotes.deleteQuote", () => quotes.deleteQuote(ID)],
  ["quotes.fetchQuoteItems", () => quotes.fetchQuoteItems(ID)],
  ["quotes.deleteQuoteItem", () => quotes.deleteQuoteItem(ID)],
  ["quotes.convertQuoteToOrder", () => quotes.convertQuoteToOrder(ID)],
  ["tasks.fetchTaskById", () => tasks.fetchTaskById(ID)],
  ["staffManagement.fetchStaffMembers", () => staffManagement.fetchStaffMembers()],
  ["staffManagement.updateStaffMember", () => staffManagement.updateStaffMember(1, { is_active: false })],
  ["staffManagement.deactivateStaffMember", () => staffManagement.deactivateStaffMember(1)],
  ["ateliers.fetchAteliers", () => ateliers.fetchAteliers()],
];

describe("http-сервисы: форма URL", () => {
  beforeEach(() => {
    [get, post, patch, del].forEach((m) => m.mockClear());
  });

  it.each(CASES)("%s не даёт двойного слэша", async (_name, call) => {
    await call();
    const paths = calledPaths();
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p).not.toContain("//");
      expect(p.startsWith("/v1/")).toBe(true);
    }
  });

  it("id подставляется ровно один раз и путь оканчивается слэшем", async () => {
    await measurements.updateMeasurement(ID, { quantity: 3 });
    expect(patch).toHaveBeenCalledTimes(1);
    const path = patch.mock.calls[0][0];
    expect(path).toBe(`/v1/measurements/${ID}/`);
  });

  it("вложенный action тоже без двойного слэша", async () => {
    // addQuoteItem клеит и id, и суффикс — здесь опечатка и жила.
    await quotes.addQuoteItem(ID, {} as never);
    const path = post.mock.calls[0][0];
    expect(path).toBe(`/v1/quotes/${ID}/add_item/`);
  });

  it("тело запроса не превращается в путь", async () => {
    // Страховка от перепутанных аргументов: PATCH шлёт данные вторым.
    await measurements.updateMeasurement(ID, { quantity: 5 });
    expect(patch.mock.calls[0][1]).toEqual({ quantity: 5 });
  });
});
