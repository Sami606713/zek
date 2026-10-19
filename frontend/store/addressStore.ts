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

// Saved addresses live in the signed-in shopper's account (one of them is the default,
// used first at checkout). Signing out clears them from this browser.
type AddressState = {
  addresses: Address[];
  defaultId: string | null;
  hydrated: boolean;
  loading: boolean;
  save: (address: Omit<Address, "id"> & { id?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  /** Load the account's addresses and which one is the default. */
  load: () => Promise<void>;
  reset: () => void;
};

export const useAddressStore = create<AddressState>()(
  persist(
    (set, get) => ({
      addresses: [],
      defaultId: null,
      hydrated: false,
      loading: false,
      save: async ({ id, ...input }) => {
        if (id) {
          const updated = await addressApi.updateAddress(id, input);
          set({ addresses: get().addresses.map((a) => (a.id === id ? updated : a)) });
        } else {
          // The first address becomes the default.
          const first = get().addresses.length === 0;
          const created = await addressApi.createAddress(input, first);
          set({ addresses: [...get().addresses, created], defaultId: first ? created.id : get().defaultId });
        }
      },
      remove: async (id) => {
        await addressApi.deleteAddress(id);
        await get().load(); // the server picks the next default if this one was it
      },
      setDefault: async (id) => {
        const previous = get().defaultId;
        set({ defaultId: id });
        try {
          await addressApi.setDefaultAddress(id);
        } catch (e) {
          set({ defaultId: previous });
          throw e;
        }
      },
      load: async () => {
        set({ loading: true });
        try {
          const { addresses, defaultId } = await addressApi.fetchAddresses();
          set({ addresses, defaultId });
        } catch {
          // offline or not signed in: keep what's shown
        } finally {
          set({ loading: false });
        }
      },
      reset: () => set({ addresses: [], defaultId: null }),
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
