import Link from "next/link";
import { ZekWordmark } from "@/components/brand/ZekLogo";

/** The ZEK wordmark, linking home (navbar, footer, login, checkout and 404 pages). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="ZEK home" className={`inline-flex items-center ${className}`}>
      <ZekWordmark className="h-6 w-auto" />
    </Link>
  );
}
