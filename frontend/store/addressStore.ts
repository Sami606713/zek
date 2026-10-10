import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as addressApi from "@/lib/api/addresses";

export type Address = {
  id: string;
  label: string;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  phone?: string;
};

type AddressState = {
  addresses: Address[];
  defaultId: string | null;
  hydrated: boolean;
  loading: boolean;
  save: (address: Omit<Address, "id"> & { id?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setDefault: (id: string) => void;
  fetchAddresses: () => Promise<void>;
  syncFromServer: (addresses: Address[]) => void;
};

export const useAddressStore = create<AddressState>()(
  persist(
    (set, get) => ({
      addresses: [],
      defaultId: null,
      hydrated: false,
      loading: false,
      save: async (input) => {
        if (input.id) {
          const updated = await addressApi.updateAddress(input.id, input);
          set({
            addresses: get().addresses.map((a) => (a.id === input.id ? updated : a)),
          });
        } else {
          const created = await addressApi.createAddress(input);
          set({
            addresses: [...get().addresses, created],
            defaultId: get().defaultId ?? created.id,
          });
        }
      },
      remove: async (id) => {
        await addressApi.deleteAddress(id);
        const addresses = get().addresses.filter((a) => a.id !== id);
        set({ addresses, defaultId: get().defaultId === id ? (addresses[0]?.id ?? null) : get().defaultId });
      },
      setDefault: (id) => set({ defaultId: id }),
      fetchAddresses: async () => {
        set({ loading: true });
        try {
          const addresses = await addressApi.fetchAddresses();
          set({ addresses });
        } finally {
          set({ loading: false });
        }
      },
      syncFromServer: (addresses) => set({ addresses }),
    }),
    {
      name: "zek-addresses",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ addresses, defaultId }) => ({ addresses, defaultId }),
      skipHydration: true,
      onRehydrateStorage: () => () => useAddressStore.setState({ hydrated: true }),
    },
  ),
);
