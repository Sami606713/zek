import { api } from "./client";
import { mapAddress } from "./mappers";
import type { ApiAddress } from "./types";
import type { Address } from "@/store/addressStore";

/** The site's address shape to the API's field names. */
const toApi = (a: Partial<Omit<Address, "id">>, isDefault?: boolean) => ({
  ...(a.label !== undefined && { label: a.label.trim() || null }),
  ...(a.name !== undefined && { full_name: a.name }),
  ...(a.phone !== undefined && { phone: a.phone || null }),
  ...(a.line1 !== undefined && { line1: a.line1 }),
  ...(a.line2 !== undefined && { line2: a.line2 || null }),
  ...(a.city !== undefined && { city: a.city }),
  ...(a.region !== undefined && { region: a.region }),
  ...(a.postal !== undefined && { postal_code: a.postal }),
  ...(a.country !== undefined && { country: a.country }),
  ...(isDefault !== undefined && { is_default: isDefault }),
});

export async function fetchAddresses(): Promise<{ addresses: Address[]; defaultId: string | null }> {
  const items = await api.get<ApiAddress[]>("/me/addresses", { auth: true });
  return { addresses: items.map(mapAddress), defaultId: items.find((a) => a.is_default)?.id ?? null };
}

export async function createAddress(input: Omit<Address, "id">, isDefault: boolean): Promise<Address> {
  const created = await api.post<ApiAddress>("/me/addresses", toApi(input, isDefault), { auth: true });
  return mapAddress(created);
}

export async function updateAddress(id: string, input: Partial<Omit<Address, "id">>): Promise<Address> {
  const updated = await api.patch<ApiAddress>(`/me/addresses/${id}`, toApi(input), { auth: true });
  return mapAddress(updated);
}

export async function deleteAddress(id: string): Promise<void> {
  await api.delete<void>(`/me/addresses/${id}`, { auth: true });
}

export async function setDefaultAddress(id: string): Promise<Address> {
  const updated = await api.post<ApiAddress>(`/me/addresses/${id}/default`, undefined, { auth: true });
  return mapAddress(updated);
}
