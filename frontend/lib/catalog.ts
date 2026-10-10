// Mock catalogue. Replaced by the FastAPI product API in Phase 3.
// Ratings, review counts and stock levels are sample data.

export type CategorySlug = "audio" | "tech" | "home" | "style" | "kitchen";

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: CategorySlug;
  price: number;
  compareAt?: number;
  image: string;
  gallery: string[];
  tag?: "New" | "Low stock";
  rating: number;
  reviews: number;
  stock: number;
  addedOn: string; // ISO date, drives "Newest" sort
  description: string;
  details: string[];
  colors?: { name: string; hex: string }[];
};

export type Category = {
  slug: CategorySlug;
  name: string;
  blurb: string;
  image: string;
};

const img = (id: number, w: number, h: number) =>
  `https://picsum.photos/id/${id}/${w}/${h}`;

// Main shot plus two alternate crops of the same photo for the gallery.
const shots = (id: number) => [
  img(id, 1000, 1250),
  img(id, 1250, 1000),
  img(id, 900, 900),
];

export const categories: Category[] = [
  {
    slug: "audio",
    name: "Audio",
    blurb: "Turntables, headphones and speakers, picked for everyday listening.",
    image: img(39, 1200, 1400),
  },
  {
    slug: "tech",
    name: "Tech",
    blurb: "Laptops, keyboards and accessories.",
    image: img(0, 900, 700),
  },
  {
    slug: "home",
    name: "Home",
    blurb: "Furniture, lighting and desk.",
    image: img(42, 900, 700),
  },
  {
    slug: "style",
    name: "Style",
    blurb: "Shoes, bags and accessories.",
    image: img(103, 900, 700),
  },
  {
    slug: "kitchen",
    name: "Kitchen",
    blurb: "Coffee, tea and cookware.",
    image: img(431, 900, 700),
  },
];

type Seed = Omit<Product, "image" | "gallery"> & { photo: number };

const seeds: Seed[] = [
  {
    id: "p-vela-35",
    name: "Vela 35 Film Camera",
    brand: "Halden Optics",
    category: "tech",
    price: 129,
    compareAt: 159,
    photo: 250,
    tag: "New",
    rating: 4.7,
    reviews: 212,
    stock: 18,
    addedOn: "2026-10-06",
    description:
      "A fully manual 35mm rangefinder for people learning film. Light enough to carry all day, simple enough to master in a weekend.",
    details: ["35mm film, ISO 25 to 1600", "40mm f/2.8 lens", "Weighs 410 g", "Refurbished and tested, 1-year warranty"],
    colors: [
      { name: "Silver", hex: "#c9ccd1" },
      { name: "Black", hex: "#1d1e22" },
    ],
  },
  {
    id: "p-twin-bell",
    name: "Twin Bell Alarm Clock",
    brand: "Kestrel",
    category: "home",
    price: 39,
    photo: 357,
    rating: 4.4,
    reviews: 88,
    stock: 42,
    addedOn: "2026-10-04",
    description:
      "A brass twin-bell clock with a loud, honest ring. Quiet sweep movement, so it will not tick you awake.",
    details: ["Silent sweep movement", "Brass case, glass face", "Runs on 1 AA battery", "11 cm tall"],
  },
  {
    id: "p-flat-keys",
    name: "Flat Keys Wireless Keyboard",
    brand: "Oberra",
    category: "tech",
    price: 89,
    photo: 366,
    tag: "Low stock",
    rating: 4.6,
    reviews: 341,
    stock: 4,
    addedOn: "2026-09-28",
    description:
      "Low-profile scissor keys with a quiet, short travel. Pairs with three devices and switches between them in one tap.",
    details: ["Bluetooth, pairs with 3 devices", "USB-C, about 2 months per charge", "Aluminium top case", "Mac and Windows layouts"],
    colors: [
      { name: "Silver", hex: "#d6d8dc" },
      { name: "Graphite", hex: "#3a3d44" },
    ],
  },
  {
    id: "p-pulse-pad",
    name: "Pulse Wireless Controller",
    brand: "Northvale",
    category: "tech",
    price: 54.9,
    photo: 96,
    rating: 4.3,
    reviews: 129,
    stock: 31,
    addedOn: "2026-09-21",
    description:
      "A wireless controller that works with PC, phone and TV boxes. Textured grips and a battery that lasts a long weekend.",
    details: ["Bluetooth and 2.4 GHz dongle", "Around 30 hours per charge", "Works with PC, Android and iOS", "Rumble and gyro"],
  },
  {
    id: "p-folio-reader",
    name: "Folio E-Reader, 6 inch",
    brand: "Papyr",
    category: "tech",
    price: 119,
    photo: 367,
    tag: "New",
    rating: 4.8,
    reviews: 506,
    stock: 23,
    addedOn: "2026-10-08",
    description:
      "A glare-free 6 inch screen with a warm front light for reading at night. Holds thousands of books and weeks of battery.",
    details: ["6 inch 300 ppi e-ink display", "Adjustable warm light", "16 GB storage", "Water resistant"],
  },
  {
    id: "p-daily-mug",
    name: "Daily Ceramic Mug",
    brand: "Sora Home",
    category: "kitchen",
    price: 24.5,
    photo: 30,
    rating: 4.5,
    reviews: 74,
    stock: 60,
    addedOn: "2026-09-15",
    description: "A heavy stoneware mug that keeps coffee warm a little longer. Dishwasher and microwave safe.",
    details: ["Stoneware, 350 ml", "Dishwasher safe", "Microwave safe", "Hand glazed, each one varies"],
  },
  {
    id: "p-aria-turntable",
    name: "Aria Belt-Drive Turntable",
    brand: "Halden Audio",
    category: "audio",
    price: 249,
    compareAt: 289,
    photo: 39,
    rating: 4.7,
    reviews: 163,
    stock: 9,
    addedOn: "2026-09-30",
    description:
      "A belt-drive turntable with a built-in preamp, so it plugs straight into powered speakers. Comes with the cartridge fitted.",
    details: ["33 and 45 rpm", "Switchable phono preamp", "Pre-fitted moving magnet cartridge", "Dust cover included"],
    colors: [
      { name: "Walnut", hex: "#6b4a33" },
      { name: "White", hex: "#eceef1" },
    ],
  },
  {
    id: "p-parlor-guitar",
    name: "Parlor Acoustic Guitar",
    brand: "Fretwell",
    category: "audio",
    price: 189,
    photo: 145,
    rating: 4.5,
    reviews: 57,
    stock: 12,
    addedOn: "2026-08-30",
    description: "A small-bodied acoustic that is easy to hold and loud for its size. A good first guitar and a good couch guitar.",
    details: ["Solid spruce top", "Mahogany back and sides", "Gig bag included", "Set up before shipping"],
  },
  {
    id: "p-nova-phone",
    name: "Nova 5 Smartphone, 128 GB",
    brand: "Lumo",
    category: "tech",
    price: 499,
    compareAt: 549,
    photo: 160,
    rating: 4.4,
    reviews: 892,
    stock: 27,
    addedOn: "2026-09-25",
    description: "A compact phone with a strong camera and a battery that gets through a full day. Unlocked for all carriers.",
    details: ["6.1 inch OLED display", "128 GB storage", "Dual camera with night mode", "Unlocked, dual SIM"],
    colors: [
      { name: "Black", hex: "#16181d" },
      { name: "Silver", hex: "#cfd2d6" },
    ],
  },
  {
    id: "p-glide-mouse",
    name: "Glide Wireless Mouse",
    brand: "Oberra",
    category: "tech",
    price: 39,
    photo: 201,
    rating: 4.2,
    reviews: 210,
    stock: 55,
    addedOn: "2026-08-12",
    description: "A slim wireless mouse with silent clicks. Matches the Flat Keys keyboard and pairs the same way.",
    details: ["Silent switches", "USB-C rechargeable", "Bluetooth, 3 devices", "Weighs 78 g"],
  },
  {
    id: "p-royal-typewriter",
    name: "Desk Typewriter, Restored",
    brand: "Kestrel",
    category: "home",
    price: 289,
    photo: 403,
    tag: "Low stock",
    rating: 4.9,
    reviews: 31,
    stock: 2,
    addedOn: "2026-10-01",
    description: "A restored mid-century typewriter, cleaned, oiled and fitted with a new ribbon. Ready to write on arrival.",
    details: ["Fully serviced", "New ribbon fitted", "Carry case included", "One of a kind, finish varies"],
  },
  {
    id: "p-studio-notebooks",
    name: "Studio Notebook Set of 3",
    brand: "Papyr",
    category: "home",
    price: 18,
    photo: 20,
    rating: 4.6,
    reviews: 144,
    stock: 80,
    addedOn: "2026-08-20",
    description: "Three lay-flat notebooks with thick paper that handles fountain pens. Dotted, lined and blank.",
    details: ["A5, 120 pages each", "100 gsm paper", "Lay-flat binding", "Dotted, lined and blank"],
  },
  {
    id: "p-field-sneakers",
    name: "Field Canvas Sneakers",
    brand: "Northvale",
    category: "style",
    price: 72,
    photo: 103,
    rating: 4.3,
    reviews: 318,
    stock: 36,
    addedOn: "2026-09-10",
    description: "Everyday canvas high-tops with a cushioned insole. Broken in from the first wear.",
    details: ["Cotton canvas upper", "Vulcanised rubber sole", "Cushioned insole", "Sizes 36 to 46"],
    colors: [
      { name: "Navy", hex: "#1f2a44" },
      { name: "Chalk", hex: "#e7e8ea" },
    ],
  },
  {
    id: "p-satin-heels",
    name: "Satin Pointed Heels",
    brand: "Maison Ilka",
    category: "style",
    price: 128,
    photo: 21,
    tag: "New",
    rating: 4.1,
    reviews: 46,
    stock: 14,
    addedOn: "2026-10-07",
    description: "Pointed satin pumps on a 9 cm heel with a padded footbed for longer evenings.",
    details: ["Satin upper", "9 cm heel", "Padded leather footbed", "Sizes 35 to 41"],
  },
  {
    id: "p-tea-press",
    name: "Glass Tea Press, 600 ml",
    brand: "Sora Home",
    category: "kitchen",
    price: 34,
    photo: 225,
    rating: 4.6,
    reviews: 97,
    stock: 40,
    addedOn: "2026-09-05",
    description: "A borosilicate glass press for loose-leaf tea. The fine steel mesh keeps leaves out of your cup.",
    details: ["Borosilicate glass", "Stainless steel mesh filter", "600 ml", "Dishwasher safe"],
  },
  {
    id: "p-origin-beans",
    name: "Single Origin Coffee Beans, 1 kg",
    brand: "Ridge Roasters",
    category: "kitchen",
    price: 31,
    photo: 425,
    rating: 4.8,
    reviews: 403,
    stock: 64,
    addedOn: "2026-09-18",
    description: "Medium-roast whole beans from a single farm in Huila, Colombia. Notes of cocoa, red apple and caramel.",
    details: ["Whole bean, 1 kg", "Medium roast", "Roasted within 7 days of shipping", "Huila, Colombia"],
  },
];

export const products: Product[] = seeds.map(({ photo, ...rest }) => {
  const gallery = shots(photo);
  return { ...rest, image: img(photo, 800, 1000), gallery };
});

// Home page rail keeps its original six picks.
export const newArrivals: Product[] = [
  "p-vela-35",
  "p-twin-bell",
  "p-flat-keys",
  "p-pulse-pad",
  "p-folio-reader",
  "p-daily-mug",
].map((id) => products.find((p) => p.id === id)!);

export type Collection = {
  slug: string;
  title: string;
  blurb: string;
  image: string;
  productIds: string[];
};

// Hand-picked themes. Membership is explicit so the store team controls it.
export const collections: Collection[] = [
  {
    slug: "work-from-home",
    title: "Work from home setup",
    blurb: "A quieter, tidier desk. The keyboard, mouse and small things that make long days easier.",
    image: img(445, 1600, 1000),
    productIds: [
      "p-flat-keys",
      "p-glide-mouse",
      "p-studio-notebooks",
      "p-twin-bell",
      "p-daily-mug",
      "p-folio-reader",
    ],
  },
  {
    slug: "gifts-under-50",
    title: "Gifts under $50",
    blurb: "Easy wins for birthdays and thank-yous. Every pick is under $50 and ships free with a second item.",
    image: img(20, 1200, 1200),
    productIds: [
      "p-studio-notebooks",
      "p-daily-mug",
      "p-origin-beans",
      "p-tea-press",
      "p-twin-bell",
      "p-glide-mouse",
    ],
  },
  {
    slug: "coffee-and-tea",
    title: "Coffee and tea ritual",
    blurb: "Beans, a good press and a mug that keeps it warm.",
    image: img(63, 1200, 1200),
    productIds: ["p-origin-beans", "p-tea-press", "p-daily-mug"],
  },
  {
    slug: "new-this-month",
    title: "New this month",
    blurb: "The latest arrivals in the store, from film cameras to e-readers.",
    image: img(48, 1200, 1200),
    productIds: [
      "p-folio-reader",
      "p-satin-heels",
      "p-vela-35",
      "p-twin-bell",
      "p-royal-typewriter",
    ],
  },
];

export const getCollection = (slug: string) =>
  collections.find((c) => c.slug === slug);

export const collectionProducts = (collection: Collection) =>
  collection.productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));

export const heroImage = img(26, 1200, 1500);
export const agentDemoProduct = newArrivals[0];

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const getCategory = (slug: string) =>
  categories.find((c) => c.slug === slug);

export const relatedProducts = (product: Product, limit = 6) =>
  products
    .filter((p) => p.id !== product.id)
    .sort(
      (a, b) =>
        Number(b.category === product.category) -
        Number(a.category === product.category),
    )
    .slice(0, limit);

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );
