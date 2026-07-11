// Minimal in-memory jest mock for expo-secure-store — mirrors the API surface
// this project uses (get/set/delete Async). expo-secure-store has no native
// module in the Jest/Node environment, so it needs an explicit mock like
// @react-native-async-storage/async-storage does (see jest.config.js).
const store = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return store.has(key) ? store.get(key)! : null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  store.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  store.delete(key);
}

export function getItem(key: string): string | null {
  return store.has(key) ? store.get(key)! : null;
}

export function setItem(key: string, value: string): void {
  store.set(key, value);
}

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export function canUseBiometricAuthentication(): boolean {
  return false;
}

// Test-only helper to reset state between tests (not part of the real API).
export function __clear(): void {
  store.clear();
}
