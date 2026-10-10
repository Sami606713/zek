// Static mock data for the admin panel. Replaced by FastAPI /api/v1/admin/* in Phase 7.
// Generated from a fixed seed and a fixed "today" so server and client render identical numbers.

import { products as catalogProducts, collections as catalogCollections, type Product } from "@/lib/catalog";

export const TODAY = new Date("2026-10-10T15:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261010);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const round = (n: number) => Math.round(n * 100) / 100;

// ─── Customers ───────────────────────────────────────────────────────────────

export type AdminCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  country: string;
  joinedAt: string;
  status: "active" | "locked";
  verified: boolean;
};

const people: [string, string, string][] = [
  ["Amna Rauf", "Lahore", "Pakistan"],
  ["Bilal Khan", "Karachi", "Pakistan"],
  ["Hira Siddiqui", "Islamabad", "Pakistan"],
  ["Usman Tariq", "Lahore", "Pakistan"],
  ["Zainab Malik", "Karachi", "Pakistan"],
  ["Omar Farooq", "Dubai", "United Arab Emirates"],
  ["Maya Lindqvist", "London", "United Kingdom"],
  ["Daniel Okafor", "Toronto", "Canada"],
  ["Priya Raman", "Chicago", "United States"],
  ["Lucas Moreau", "Berlin", "Germany"],
  ["Sofia Petrova", "London", "United Kingdom"],
  ["Kenji Sato", "Toronto", "Canada"],
  ["Aisha Bello", "Chicago", "United States"],
  ["Noah Kim", "Austin", "United States"],
  ["Fatima Noor", "Islamabad", "Pakistan"],
  ["Ethan Brooks", "Denver", "United States"],
  ["Leila Haddad", "Dubai", "United Arab Emirates"],
  ["Mateo Garcia", "Berlin", "Germany"],
  ["Chloe Dubois", "London", "United Kingdom"],
  ["Hamza Qureshi", "Lahore", "Pakistan"],
  ["Sara Ahmed", "Karachi", "Pakistan"],
  ["Jonas Weber", "Berlin", "Germany"],
  ["Imran Shah", "Peshawar", "Pakistan"],
  ["Nadia Rahman", "Toronto", "Canada"],
  ["Grace Mwangi", "Chicago", "United States"],
  ["Ali Raza", "Multan", "Pakistan"],
  ["Elena Rossi", "London", "United Kingdom"],
  ["Tariq Mehmood", "Faisalabad", "Pakistan"],
  ["Hannah Cole", "Seattle", "United States"],
  ["Yusuf Demir", "Dubai", "United Arab Emirates"],
  ["Mariam Javed", "Lahore", "Pakistan"],
  ["Oliver Grant", "Toronto", "Canada"],
  ["Ayesha Siddiq", "Karachi", "Pakistan"],
  ["Ravi Patel", "Chicago", "United States"],
  ["Ines Carvalho", "Berlin", "Germany"],
  ["Saad Hussain", "Islamabad", "Pakistan"],
];

export const customers: AdminCustomer[] = people.map(([name, city, country], i) => {
  const [first, last] = name.toLowerCase().split(" ");
  return {
    id: `C-${1001 + i}`,
    name,
    email: `${first}.${last}@example.com`,
    phone: country === "Pakistan" ? `+92 3${between(0, 4)}${between(1, 9)} ${between(1000000, 9999999)}` : `+1 ${between(200, 989)} ${between(200, 999)} ${between(1000, 9999)}`,
    street: `${between(4, 240)} ${pick(["Market Street", "Mall Road", "Clark Street", "Canal View", "King Street", "Garden Avenue", "Park Lane", "Main Boulevard"])}`,
    city,
    country,
    joinedAt: new Date(TODAY.getTime() - between(5, 420) * DAY).toISOString(),
    status: i === 7 || i === 22 ? "locked" : "active",
    verified: rand() > 0.15,
  };
});

// ─── Products (admin view of the catalogue) ──────────────────────────────────

export type ProductStatus = "active" | "draft" | "archived";

export type AdminProduct = Product & {
  status: ProductStatus;
  lowStockThreshold: number;
  sold30d: number;
};

export const adminProducts: AdminProduct[] = [
  ...catalogProducts.map((p, i) => ({
    ...p,
    status: "active" as ProductStatus,
    lowStockThreshold: 5,
    sold30d: 0,
    // a couple of items out of stock so inventory views have something to show
    stock: i === 9 ? 0 : p.stock,
  })),
  {
    ...catalogProducts[6],
    id: "p-aria-mini",
    name: "Aria Mini Turntable",
    price: 179,
    compareAt: undefined,
    stock: 0,
    tag: undefined,
    rating: 0,
    reviews: 0,
    addedOn: "2026-10-09",
    status: "draft",
    lowStockThreshold: 5,
    sold30d: 0,
  },
  {
    ...catalogProducts[12],
    id: "p-field-boots",
    name: "Field Leather Boots",
    price: 148,
    compareAt: undefined,
    stock: 22,
    tag: undefined,
    rating: 4.2,
    reviews: 61,
    addedOn: "2025-11-02",
    status: "archived",
    lowStockThreshold: 5,
    sold30d: 0,
  },
];

const sellable = adminProducts.filter((p) => p.status === "active" && p.stock > 0);

// ─── Orders ──────────────────────────────────────────────────────────────────

export type Channel = "web" | "agent" | "whatsapp" | "voice";
export type FulfilmentStatus = "confirmed" | "packed" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "paid" | "pending" | "refunded";

export type AdminOrderLine = {
  productId: string;
  name: string;
  image: string;
  color?: string;
  quantity: number;
  price: number;
};

export type AdminOrder = {
  id: string;
  customerId: string;
  createdAt: string;
  channel: Channel;
  status: FulfilmentStatus;
  payment: { method: "card" | "cod"; status: PaymentStatus; last4?: string };
  delivery: "standard" | "express";
  lines: AdminOrderLine[];
  totals: { subtotal: number; discount: number; shipping: number; tax: number; total: number };
  promo: string | null;
  tracking?: string;
  notes: string[];
};

export const channelLabels: Record<Channel, string> = {
  web: "Web shop",
  agent: "Agent chat",
  whatsapp: "WhatsApp",
  voice: "Voice",
};

function makeOrder(index: number): AdminOrder {
  // More orders on recent days, fewer further back, with a weekend bump.
  const daysAgo = Math.floor(Math.pow(rand(), 1.3) * 60);
  const created = new Date(TODAY.getTime() - daysAgo * DAY - between(0, 22) * 60 * 60 * 1000);
  const day = created.getUTCDay();
  if ((day === 0 || day === 6) && rand() < 0.15) created.setTime(created.getTime() - DAY);

  const lineCount = rand() < 0.6 ? 1 : rand() < 0.75 ? 2 : 3;
  const used = new Set<string>();
  const lines: AdminOrderLine[] = [];
  for (let i = 0; i < lineCount; i++) {
    const p = pick(sellable);
    if (used.has(p.id)) continue;
    used.add(p.id);
    lines.push({
      productId: p.id,
      name: p.name,
      image: p.image,
      color: p.colors ? pick(p.colors).name : undefined,
      quantity: p.price < 40 && rand() < 0.4 ? 2 : 1,
      price: p.price,
    });
  }

  const subtotal = round(lines.reduce((s, l) => s + l.price * l.quantity, 0));
  const promo = rand() < 0.18 ? "ZEK10" : null;
  const discount = promo ? round(subtotal * 0.1) : 0;
  const after = subtotal - discount;
  const delivery = rand() < 0.22 ? "express" : "standard";
  const shipping = delivery === "express" ? 14.99 : after >= 50 ? 0 : 5.99;
  const tax = round(after * 0.08);
  const total = round(after + shipping + tax);

  const r = rand();
  const channel: Channel = r < 0.46 ? "web" : r < 0.76 ? "agent" : r < 0.93 ? "whatsapp" : "voice";
  const method = channel === "whatsapp" && rand() < 0.6 ? "cod" : rand() < 0.2 ? "cod" : "card";

  let status: FulfilmentStatus;
  if (daysAgo === 0) status = rand() < 0.65 ? "confirmed" : "packed";
  else if (daysAgo <= 2) status = rand() < 0.3 ? "packed" : "shipped";
  else if (daysAgo <= 5) status = rand() < 0.55 ? "shipped" : "delivered";
  else status = "delivered";
  if (rand() < 0.05) status = "cancelled";

  const paymentStatus: PaymentStatus =
    status === "cancelled"
      ? method === "card" ? "refunded" : "pending"
      : method === "cod" && status !== "delivered" ? "pending" : "paid";

  return {
    id: `ZEK-${String(700000 + index * 137 + between(0, 99)).padStart(6, "0")}`,
    // A few loyal customers order often; most order once or twice.
    customerId: customers[Math.floor(Math.pow(rand(), 2.4) * customers.length)].id,
    createdAt: created.toISOString(),
    channel,
    status,
    payment: { method, status: paymentStatus, last4: method === "card" ? String(between(1000, 9999)) : undefined },
    delivery,
    lines,
    totals: { subtotal, discount, shipping, tax, total },
    promo,
    tracking: status === "shipped" || status === "delivered" ? `1Z${between(100000, 999999)}${between(1000, 9999)}` : undefined,
    notes: [],
  };
}

export const adminOrders: AdminOrder[] = Array.from({ length: 560 }, (_, i) => makeOrder(i)).sort(
  (a, b) => b.createdAt.localeCompare(a.createdAt),
);

// Tally units sold per product (last 30 days) for the products table and "top products".
for (const order of adminOrders) {
  if (order.status === "cancelled" || TODAY.getTime() - new Date(order.createdAt).getTime() > 30 * DAY) continue;
  for (const line of order.lines) {
    const p = adminProducts.find((x) => x.id === line.productId);
    if (p) p.sold30d += line.quantity;
  }
}

export const getAdminOrder = (id: string) => adminOrders.find((o) => o.id === id);
export const getCustomer = (id: string) => customers.find((c) => c.id === id);
export const customerOrders = (id: string) => adminOrders.filter((o) => o.customerId === id);

export function customerStats(id: string) {
  const orders = customerOrders(id).filter((o) => o.status !== "cancelled");
  const spent = round(orders.reduce((s, o) => s + o.totals.total, 0));
  return {
    orders: orders.length,
    spent,
    lastOrder: orders[0]?.createdAt ?? null,
    aov: orders.length ? round(spent / orders.length) : 0,
  };
}

// ─── Dashboard series ────────────────────────────────────────────────────────

export type DayPoint = { date: string; revenue: number; orders: number } & Record<Channel, number>;

export function dailySeries(days = 30): DayPoint[] {
  const points: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(TODAY.getTime() - i * DAY);
    const key = d.toISOString().slice(0, 10);
    points.push({ date: key, revenue: 0, orders: 0, web: 0, agent: 0, whatsapp: 0, voice: 0 });
  }
  for (const o of adminOrders) {
    if (o.status === "cancelled") continue;
    const point = points.find((p) => p.date === o.createdAt.slice(0, 10));
    if (!point) continue;
    point.revenue = round(point.revenue + o.totals.total);
    point.orders += 1;
    point[o.channel] = round(point[o.channel] + o.totals.total);
  }
  return points;
}

export function periodStats(days: number) {
  const now = TODAY.getTime();
  const inRange = (o: AdminOrder, from: number, to: number) => {
    const t = new Date(o.createdAt).getTime();
    return t > now - from * DAY && t <= now - to * DAY && o.status !== "cancelled";
  };
  const current = adminOrders.filter((o) => inRange(o, days, 0));
  const previous = adminOrders.filter((o) => inRange(o, days * 2, days));
  const sum = (list: AdminOrder[]) => round(list.reduce((s, o) => s + o.totals.total, 0));
  const visitors = (n: number) => n * 23 + 140; // mock traffic for conversion rate
  const revenue = sum(current);
  const prevRevenue = sum(previous);
  return {
    revenue,
    revenueChange: prevRevenue ? (revenue - prevRevenue) / prevRevenue : 0,
    orders: current.length,
    ordersChange: previous.length ? (current.length - previous.length) / previous.length : 0,
    aov: current.length ? round(revenue / current.length) : 0,
    aovChange:
      previous.length && current.length
        ? revenue / current.length / (prevRevenue / previous.length) - 1
        : 0,
    conversion: current.length / visitors(current.length),
    conversionChange: 0.004,
  };
}

export function salesByCategory(days = 30) {
  const totals: Record<string, number> = {};
  for (const o of adminOrders) {
    if (o.status === "cancelled" || TODAY.getTime() - new Date(o.createdAt).getTime() > days * DAY) continue;
    for (const l of o.lines) {
      const p = adminProducts.find((x) => x.id === l.productId);
      if (!p) continue;
      totals[p.category] = round((totals[p.category] ?? 0) + l.price * l.quantity);
    }
  }
  return Object.entries(totals)
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ─── Collections ─────────────────────────────────────────────────────────────

export type AdminCollection = (typeof catalogCollections)[number] & { visible: boolean };
export const adminCollections: AdminCollection[] = catalogCollections.map((c) => ({ ...c, visible: true }));

// ─── Discounts ───────────────────────────────────────────────────────────────

export type Discount = {
  code: string;
  type: "percent" | "fixed" | "shipping";
  value: number;
  minOrder: number;
  startsAt: string;
  endsAt: string | null;
  usageLimit: number | null;
  used: number;
  active: boolean;
};

export const discounts: Discount[] = [
  { code: "ZEK10", type: "percent", value: 10, minOrder: 0, startsAt: "2026-09-01", endsAt: null, usageLimit: null, used: adminOrders.filter((o) => o.promo === "ZEK10").length, active: true },
  { code: "WELCOME15", type: "percent", value: 15, minOrder: 40, startsAt: "2026-08-15", endsAt: null, usageLimit: 1000, used: 212, active: true },
  { code: "FREESHIP", type: "shipping", value: 0, minOrder: 25, startsAt: "2026-10-01", endsAt: "2026-10-31", usageLimit: null, used: 87, active: true },
  { code: "AUTUMN20", type: "percent", value: 20, minOrder: 100, startsAt: "2026-09-20", endsAt: "2026-10-05", usageLimit: 300, used: 300, active: false },
  { code: "VIP25", type: "fixed", value: 25, minOrder: 150, startsAt: "2026-11-01", endsAt: "2026-11-30", usageLimit: 200, used: 0, active: true },
];

// ─── Agent conversations ─────────────────────────────────────────────────────

export type ToolCall = { name: string; input: Record<string, unknown>; output: unknown };
export type Message =
  | { role: "user"; text: string; at: string }
  | { role: "assistant"; text: string; at: string; tools?: ToolCall[] }
  | { role: "staff"; text: string; at: string };

export type Outcome = "purchase" | "answered" | "unresolved";

export type Conversation = {
  id: string;
  customerId: string | null;
  channel: Exclude<Channel, "web">;
  startedAt: string;
  outcome: Outcome;
  flagged: boolean;
  orderId?: string;
  summary: string;
  messages: Message[];
};

type Script = { outcome: Outcome; summary: string; build: (at: (min: number) => string, ctx: { product: Product; order: AdminOrder }) => Message[] };

const scripts: Script[] = [
  {
    outcome: "purchase",
    summary: "Asked for a product under a budget, bought it",
    build: (at, { product }) => [
      { role: "user", text: `I need a ${product.category === "tech" ? "gadget" : "gift"} under $${Math.ceil(product.price / 10) * 10 + 20}. Any ideas?`, at: at(0) },
      {
        role: "assistant",
        text: `The ${product.name} is a good fit at ${"$" + product.price}. It is rated ${product.rating} by ${product.reviews} customers. Want me to add it to your bag?`,
        at: at(1),
        tools: [{ name: "search_products", input: { query: product.category, max_price: Math.ceil(product.price / 10) * 10 + 20, limit: 3 }, output: [{ id: product.id, name: product.name, price: product.price, rating: product.rating }] }],
      },
      { role: "user", text: "Yes please, add it.", at: at(2) },
      {
        role: "assistant",
        text: "Done. It is in your bag. Shall I check out with your saved address?",
        at: at(2),
        tools: [{ name: "add_to_cart", input: { product_id: product.id, quantity: 1 }, output: { ok: true, cart_count: 1 } }],
      },
      { role: "user", text: "Yes, same address.", at: at(3) },
      {
        role: "assistant",
        text: "Order placed. You will get a confirmation on this chat and by email.",
        at: at(4),
        tools: [{ name: "create_order", input: { payment: "saved_card", address: "default" }, output: { order_id: "{{order}}", status: "confirmed" } }],
      },
    ],
  },
  {
    outcome: "answered",
    summary: "Asked where their order is",
    build: (at, { order }) => [
      { role: "user", text: "Where is my order?", at: at(0) },
      {
        role: "assistant",
        text: `Your order ${order.id} is ${order.status === "delivered" ? "delivered" : order.status === "shipped" ? "on its way with tracking " + (order.tracking ?? "") : "being packed and ships within a day"}.`,
        at: at(1),
        tools: [{ name: "get_order_status", input: { customer: "current_user", latest: true }, output: { order_id: order.id, status: order.status, tracking: order.tracking ?? null } }],
      },
      { role: "user", text: "Great, thanks!", at: at(2) },
    ],
  },
  {
    outcome: "answered",
    summary: "Compared two products",
    build: (at, { product }) => [
      { role: "user", text: `Is the ${product.name} worth it compared to the cheaper options?`, at: at(0) },
      {
        role: "assistant",
        text: `It costs more but has better reviews (${product.rating} stars). If you mainly need the basics, a cheaper option will do. I can show both side by side.`,
        at: at(1),
        tools: [{ name: "compare_products", input: { product_ids: [product.id, "similar"] }, output: { winner: product.id, reason: "higher rating, longer warranty" } }],
      },
      { role: "user", text: "Ok I'll think about it.", at: at(3) },
    ],
  },
  {
    outcome: "unresolved",
    summary: "Asked for a product we don't stock",
    build: (at) => [
      { role: "user", text: "Do you have noise cancelling earbuds?", at: at(0) },
      {
        role: "assistant",
        text: "I could not find noise cancelling earbuds in the store right now. Would a wired option or a speaker work instead?",
        at: at(1),
        tools: [{ name: "search_products", input: { query: "noise cancelling earbuds" }, output: [] }],
      },
      { role: "user", text: "No, I need earbuds. Let me know when you have them.", at: at(2) },
    ],
  },
  {
    outcome: "unresolved",
    summary: "Wanted to change the delivery address",
    build: (at, { order }) => [
      { role: "user", text: `Can I change the address on order ${order.id}?`, at: at(0) },
      {
        role: "assistant",
        text: "I can't change the address once an order is packed. I've passed this to our team and someone will reply here shortly.",
        at: at(1),
        tools: [{ name: "get_order_status", input: { order_id: order.id }, output: { status: "packed" } }, { name: "handoff_to_human", input: { reason: "address_change" }, output: { ticket: `T-${between(4000, 4999)}` } }],
      },
    ],
  },
];

export const conversations: Conversation[] = Array.from({ length: 36 }, (_, i) => {
  const script = scripts[i % scripts.length];
  const channel = pick(["agent", "agent", "whatsapp", "whatsapp", "voice"] as const);
  const order = adminOrders[between(0, 60)];
  const product = pick(sellable);
  const start = new Date(TODAY.getTime() - Math.floor(Math.pow(rand(), 1.3) * 14) * DAY - between(0, 600) * 60 * 1000);
  const at = (min: number) => new Date(start.getTime() + min * 60 * 1000 + between(5, 50) * 1000).toISOString();
  const messages = script.build(at, { product, order }).map((m) =>
    m.role === "assistant" && m.tools
      ? { ...m, tools: m.tools.map((t) => ({ ...t, output: JSON.parse(JSON.stringify(t.output).replace("{{order}}", order.id)) })) }
      : m,
  );
  return {
    id: `CV-${5200 + i}`,
    customerId: rand() < 0.85 ? order.customerId : null,
    channel: channel === "agent" ? "agent" : channel,
    startedAt: start.toISOString(),
    outcome: script.outcome,
    flagged: script.outcome === "unresolved" && rand() < 0.7,
    orderId: script.outcome === "purchase" ? order.id : undefined,
    summary: script.summary,
    messages,
  } as Conversation;
}).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const getConversation = (id: string) => conversations.find((c) => c.id === id);

export function agentDailySeries(days = 14) {
  const out: { date: string; agent: number; whatsapp: number; voice: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(TODAY.getTime() - i * DAY).toISOString().slice(0, 10);
    // Scaled up from the sample conversations to a realistic daily volume.
    out.push({ date: d, agent: between(38, 74), whatsapp: between(22, 51), voice: between(6, 17) });
  }
  return out;
}

export const agentStats = {
  conversations7d: 1042,
  conversationsChange: 0.128,
  ordersViaAgent: adminOrders.filter((o) => o.channel !== "web" && o.status !== "cancelled").length,
  agentRevenue: round(adminOrders.filter((o) => o.channel !== "web" && o.status !== "cancelled").reduce((s, o) => s + o.totals.total, 0)),
  avgResponseSec: 2.4,
  resolutionRate: 0.873,
  handoffRate: 0.041,
};

export const topQuestions = [
  { question: "Where is my order?", count: 312 },
  { question: "Gift ideas under $50", count: 188 },
  { question: "Do you deliver to my city?", count: 141 },
  { question: "Compare two products", count: 97 },
  { question: "How do returns work?", count: 83 },
];

export const missingSearches = [
  { query: "noise cancelling earbuds", count: 64 },
  { query: "standing desk", count: 41 },
  { query: "running shoes", count: 37 },
  { query: "air fryer", count: 22 },
];

// ─── Settings ────────────────────────────────────────────────────────────────

export const team = [
  { name: "Sami Ullah", email: "sami@zek.store", role: "Owner", lastActive: "Now" },
  { name: "Hira Siddiqui", email: "hira@zek.store", role: "Admin", lastActive: "2 hours ago" },
  { name: "Daniel Okafor", email: "daniel@zek.store", role: "Admin", lastActive: "Yesterday" },
];

export const integrations = [
  { name: "Stripe", detail: "Payments", status: "connected" as const },
  { name: "WhatsApp Business", detail: "Customer chat", status: "connected" as const },
  { name: "Pipecat", detail: "Voice agent", status: "attention" as const },
  { name: "Language model", detail: "Agent replies", status: "connected" as const },
  { name: "Cloudinary", detail: "Product images", status: "not_connected" as const },
];
