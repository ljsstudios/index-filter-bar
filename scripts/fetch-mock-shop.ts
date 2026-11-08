/**
 * Pulls the demo's products from mock.shop, Shopify's free, keyless sample
 * Storefront API, into demo/data/mock-shop.json. Run it again only to refresh
 * the catalog: the demo reads the saved file, so it never depends on
 * mock.shop being up.
 *
 *   node scripts/fetch-mock-shop.ts
 */
import { writeFileSync } from "node:fs";

/** Five catalogs, one vendor each, so Vendor has something to filter. */
const CATALOGS = [
  "mock.shop",
  "apparel-sneakers.mock.shop",
  "apparel-outdoor.mock.shop",
  "audio.mock.shop",
  "artisan-tableware.mock.shop",
];

const QUERY = `{
  products(first: 100) {
    nodes {
      id handle title vendor productType tags
      category { name }
      featuredImage { url altText }
      collections(first: 10) { nodes { title } }
      variants(first: 50) {
        nodes {
          id title sku
          price { amount currencyCode }
          selectedOptions { name value }
        }
      }
    }
  }
}`;

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
      selectedOptions: { name: string; value: string }[];
    }[];
  };
}

const products: (MockProduct & { catalog: string })[] = [];
for (const host of CATALOGS) {
  const response = await fetch(`https://${host}/api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY }),
  });
  const body = (await response.json()) as {
    data?: { products: { nodes: MockProduct[] } };
    errors?: unknown;
  };
  if (!body.data) throw new Error(`${host}: ${JSON.stringify(body.errors)}`);
  for (const product of body.data.products.nodes) products.push({ ...product, catalog: host });
  console.log(`${host}: ${body.data.products.nodes.length} products`);
}

writeFileSync(
  new URL("../demo/data/mock-shop.json", import.meta.url),
  `${JSON.stringify({ fetchedFrom: CATALOGS, products }, null, 1)}\n`,
);
console.log(`${products.length} products saved`);
