import type { Metadata } from "next";
import { AccountView } from "@/components/account/AccountView";

export const metadata: Metadata = {
  title: "Account | ZEK",
  robots: { index: false },
};

export default function AccountPage() {
  return <AccountView />;
}
