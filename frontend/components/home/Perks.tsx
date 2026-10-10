import {
  ArrowsCounterClockwise,
  Headset,
  LockKey,
  Truck,
} from "@phosphor-icons/react/ssr";
import { Reveal } from "@/components/motion/Reveal";

const perks = [
  { icon: Truck, title: "Free shipping over $50", body: "Most orders arrive in 2 to 4 days." },
  { icon: ArrowsCounterClockwise, title: "30-day returns", body: "Start a return in chat, no forms." },
  { icon: LockKey, title: "Secure checkout", body: "Payments handled by Stripe." },
  { icon: Headset, title: "Help 7 days a week", body: "Ask ZEK, or reach a person." },
];

export function Perks() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-20 md:px-8 md:pb-28">
      <ul className="grid grid-cols-1 gap-y-8 rounded-panel bg-surface px-6 py-8 sm:grid-cols-2 md:px-10 lg:grid-cols-4 lg:divide-x lg:divide-line lg:px-0 lg:py-10">
        {perks.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="lg:px-8">
            <Reveal delay={i * 0.06} y={16} className="flex gap-4 lg:flex-col lg:gap-5">
              <Icon size={26} className="shrink-0 text-brand" />
              <div>
                <h3 className="text-[15px] font-medium text-ink">{title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-subtle">{body}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
