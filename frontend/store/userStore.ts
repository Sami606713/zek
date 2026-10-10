import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SessionUser = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  createdAt?: string;
  prefs?: { orderEmails: boolean; whatsapp: boolean; newsletter: boolean };
  token?: string;
  refreshToken?: string;
};

type UserState = {
  user: SessionUser | null;
  hydrated: boolean;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
  updateUser: (patch: Partial<SessionUser>) => void;
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
      updateUser: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
    }),
    {
      name: "zek-session",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ user }) => ({ user }),
      skipHydration: true,
      onRehydrateStorage: () => () => useUserStore.setState({ hydrated: true }),
    },
  ),
);
