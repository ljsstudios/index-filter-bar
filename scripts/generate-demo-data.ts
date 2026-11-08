/**
 * Turns demo/data/mock-shop.json into the demo's store: demo/data/products.json
 * (the catalog with what a Storefront catalog doesn't have: a status, a
 * created date, SKUs, barcodes, weights, sales channels, and stock at three
 * locations) and demo/data/orders.json (orders of those products). Seeded, so
 * every run (and every visitor) sees the same store. Dates are stored as days
 * ago, so "Last 7 days" stays meaningful.
 *
 *   node scripts/generate-demo-data.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

/** mulberry32: a small seeded random number generator. */
const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const random = seeded(20261108);
const between = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
/** One of `items`, by weight: pickWeighted([["a", 3], ["b", 1]]). */
const pickWeighted = <T>(items: readonly (readonly [T, number])[]): T => {
  let roll = random() * items.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return items[0]?.[0] as T;
};
const days = (value: number) => Math.round(value * 10) / 10;

export const LOCATIONS = ["Shop floor", "Warehouse", "Pop-up store"] as const;
const SALES_CHANNELS = ["Online Store", "Point of Sale", "Shop", "Google & YouTube"] as const;

interface MockProduct {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  category: { name: string } | null;
  featuredImage: { url: string; altText: string | null } | null;
  collections: { nodes: { title: string }[] };
  variants: {
    nodes: {
      id: string;
      title: string;
      sku: string | null;
      price: { amount: string; currencyCode: string };
    }[];
  };
}

const source = JSON.parse(
  readFileSync(new URL("../demo/data/mock-shop.json", import.meta.url), "utf8"),
) as { products: MockProduct[] };

const prefix = (vendor: string) =>
  vendor
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);

const products = source.products.map((product, p) => {
  const status = random() < 0.72 ? "active" : random() < 0.65 ? "draft" : "archived";
  const createdDaysAgo = Math.round(random() * 365 * 10) / 10;
  const baseWeight = Math.round((0.2 + random() * 4) * 100) / 100;
  const variants = product.variants.nodes.map((variant, v) => {
    const stock = Object.fromEntries(
      LOCATIONS.map((location) => {
        const stocked = random() < 0.8;
        const onHand = stocked ? between(0, 120) : 0;
        const committed = Math.min(onHand, between(0, 12));
        const unavailable = Math.min(onHand - committed, random() < 0.15 ? between(1, 6) : 0);
        return [
          location,
          {
            available: onHand - committed - unavailable,
            committed,
            unavailable,
            onHand,
            incoming: random() < 0.25 ? between(5, 60) : 0,
            bin: random() < 0.6 ? `${pick(["A", "B", "C", "D"])}-${between(1, 24)}` : "",
          },
        ];
      }),
    );
    return {
      id: `${p + 1}-${v + 1}`,
      title: variant.title,
      sku: variant.sku || `${prefix(product.vendor)}-${String(p + 1).padStart(3, "0")}-${v + 1}`,
      price: Number(variant.price.amount),
      weightLb: Math.round(baseWeight * (1 + v * 0.05) * 100) / 100,
      barcode:
        random() < 0.7 ? String(between(100000000, 999999999)) + String(between(1000, 9999)) : "",
      fulfillable: random() < 0.92,
      stock,
    };
  });
  return {
    id: String(p + 1),
    title: product.title,
    handle: product.handle,
    image: product.featuredImage?.url ?? null,
    vendor: product.vendor,
    // The default catalog leaves product type blank; its category stands in.
    productType: product.productType || product.category?.name || "",
    category: product.category?.name ?? "",
    tags: product.tags,
    collections: product.collections.nodes.map((collection) => collection.title),
    status,
    createdDaysAgo,
    salesChannels: SALES_CHANNELS.filter((_, i) => i === 0 || random() < 0.5),
    variants,
  };
});

// ---- Orders: a year of them, lines from the catalog's active products ----
const FIRST = [
  "Ava",
  "Ben",
  "Chloe",
  "Dan",
  "Ella",
  "Finn",
  "Grace",
  "Harry",
  "Isla",
  "Jack",
  "Lily",
  "Max",
  "Mia",
  "Noah",
  "Olivia",
  "Sam",
  "Zoe",
  "Leo",
  "Ruby",
  "Theo",
];
const LAST = [
  "Smith",
  "Jones",
  "Taylor",
  "Brown",
  "Williams",
  "Wilson",
  "Johnson",
  "Davies",
  "Patel",
  "Robinson",
  "Wright",
  "Thompson",
  "Evans",
  "Walker",
  "White",
  "Roberts",
];
const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Ireland",
  "Netherlands",
];
const sellable = products.filter((product) => product.status === "active");

const orders = Array.from({ length: 420 }, (_, o) => {
  const createdDaysAgo = days(random() ** 1.6 * 365);
  const lines = Array.from(
    {
      length: pickWeighted([
        [1, 6],
        [2, 3],
        [3, 2],
        [4, 1],
      ] as const),
    },
    () => {
      const product = pick(sellable);
      const variant = pick(product.variants);
      return {
        productId: product.id,
        variantId: variant.id,
        title: product.title,
        variantTitle: variant.title,
        quantity: pickWeighted([
          [1, 8],
          [2, 3],
          [3, 1],
        ] as const),
        price: variant.price,
        weightLb: variant.weightLb,
      };
    },
  );
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const discountCode = random() < 0.18 ? pick(["WELCOME10", "SUMMER20", "VIP15", "FREESHIP"]) : "";
  const discount =
    discountCode === "WELCOME10"
      ? 0.1
      : discountCode === "SUMMER20"
        ? 0.2
        : discountCode === "VIP15"
          ? 0.15
          : 0;
  const deliveryMethod = pickWeighted([
    ["Standard", 6],
    ["Express", 2],
    ["Local delivery", 1],
    ["Pickup", 1],
  ] as const);
  const shipping =
    deliveryMethod === "Pickup"
      ? 0
      : deliveryMethod === "Express"
        ? 14.99
        : discountCode === "FREESHIP"
          ? 0
          : 5.99;
  const archived = createdDaysAgo > 60 && random() < 0.6;
  const paymentStatus = pickWeighted([
    ["Paid", 14],
    ["Pending", 2],
    ["Authorized", 1],
    ["Partially paid", 1],
    ["Refunded", 1],
    ["Partially refunded", 1],
    ["Voided", 0.3],
  ] as const);
  const fulfillmentStatus =
    paymentStatus === "Voided"
      ? "Unfulfilled"
      : createdDaysAgo > 14
        ? pickWeighted([
            ["Fulfilled", 12],
            ["Partially fulfilled", 1],
            ["Unfulfilled", 1],
          ] as const)
        : pickWeighted([
            ["Unfulfilled", 5],
            ["Fulfilled", 4],
            ["Partially fulfilled", 1],
            ["On hold", 1],
          ] as const);
  const delivered = fulfillmentStatus === "Fulfilled";
  return {
    id: String(o + 1),
    name: `#${1001 + o}`,
    createdDaysAgo,
    fulfillByDaysAgo: days(createdDaysAgo - between(1, 5)),
    customer: `${pick(FIRST)} ${pick(LAST)}`,
    channel: pickWeighted([
      ["Online Store", 8],
      ["Point of Sale", 2],
      ["Shop", 2],
      ["Draft Orders", 1],
    ] as const),
    total: Math.round((subtotal * (1 - discount) + shipping) * 100) / 100,
    currency: "USD",
    paymentStatus,
    fulfillmentStatus,
    deliveryStatus: delivered
      ? pickWeighted([
          ["Delivered", 6],
          ["In transit", 2],
          ["Out for delivery", 1],
        ] as const)
      : "",
    deliveryMethod,
    returnStatus:
      delivered && random() < 0.08
        ? pick(["Return requested", "Return in progress", "Returned"])
        : "",
    labelStatus:
      deliveryMethod === "Pickup"
        ? ""
        : delivered
          ? "Label purchased"
          : pick(["", "Label purchased"]),
    chargebackStatus:
      random() < 0.02
        ? pick(["Chargeback open", "Inquiry open", "Chargeback won", "Chargeback lost"])
        : "",
    destination: deliveryMethod === "Pickup" ? "" : pick(COUNTRIES),
    addressValidation:
      deliveryMethod === "Pickup"
        ? ""
        : pickWeighted([
            ["Valid", 9],
            ["Needs review", 1],
          ] as const),
    orderStatus: paymentStatus === "Voided" ? "Cancelled" : archived ? "Archived" : "Open",
    items: lines.reduce((sum, line) => sum + line.quantity, 0),
    weightLb:
      Math.round(lines.reduce((sum, line) => sum + line.weightLb * line.quantity, 0) * 100) / 100,
    lines,
    discountCode,
    app: pickWeighted([
      ["Online Store", 7],
      ["Point of Sale", 2],
      ["Shop", 2],
    ] as const),
    b2b: random() < 0.07,
    payoutActionRequired: random() < 0.03,
    fraudRisk: pickWeighted([
      ["Low", 18],
      ["Medium", 2],
      ["High", 0.5],
    ] as const),
    customerRequest:
      random() < 0.04 ? pick(["Cancellation requested", "Address change requested"]) : "",
    shopifyProtect: random() < 0.3 ? pick(["Protected", "Not protected"]) : "",
    cardLast4: paymentStatus === "Pending" ? "" : String(between(1000, 9999)),
    poNumber: random() < 0.1 ? `PO-${between(1000, 9999)}` : "",
    tags:
      random() < 0.35
        ? [pick(["gift", "wholesale", "priority", "repeat-customer", "influencer"])]
        : [],
  };
});

writeFileSync(
  new URL("../demo/data/products.json", import.meta.url),
  `${JSON.stringify(products)}\n`,
);
writeFileSync(new URL("../demo/data/orders.json", import.meta.url), `${JSON.stringify(orders)}\n`);
const variants = products.reduce((sum, product) => sum + product.variants.length, 0);
console.log(`${products.length} products, ${variants} variants, ${orders.length} orders`);
