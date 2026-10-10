import { api } from "./client";
import { mapAddress } from "./mappers";
import type { ApiAddress } from "./types";
import type { Address } from "@/store/addressStore";

export async function fetchAddresses(): Promise<Address[]> {
  const items = await api.get<ApiAddress[]>("/me/addresses", { auth: true });
  return items.map(mapAddress);
}

export async function createAddress(input: Omit<Address, "id">): Promise<Address> {
  const created = await api.post<ApiAddress>("/me/addresses", input, { auth: true });
  return mapAddress(created);
}

export async function updateAddress(id: string, input: Partial<Omit<Address, "id">>): Promise<Address> {
  const updated = await api.patch<ApiAddress>(`/me/addresses/${id}`, input, { auth: true });
  return mapAddress(updated);
}

export async function deleteAddress(id: string): Promise<void> {
  await api.delete<void>(`/me/addresses/${id}`, { auth: true });
}

export async function setDefaultAddress(id: string): Promise<Address> {
  const updated = await api.post<ApiAddress>(`/me/addresses/${id}/default`, undefined, { auth: true });
  return mapAddress(updated);
}
