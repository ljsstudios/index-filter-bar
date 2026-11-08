# Contributing

Issues and pull requests are welcome.

## Setup

```sh
pnpm install
pnpm demo     # http://localhost:5180, using the package's source
```

## Before a pull request

```sh
pnpm check    # typecheck, Biome, knip, tests (axe included)
pnpm build
```

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`…), checked on commit. Releases and the changelog are made from them.
- **Matching the admin:** the bar copies the Shopify admin's index bar. A change to how it looks or behaves should match the admin, so say in the pull request which admin page you compared against. Where the admin and WCAG 2.2 AA disagree, accessibility wins; the README's Accessibility section lists the cases.
- **Tests:** a behaviour change comes with a test. The tests run in happy-dom with Testing Library. `src/test/axe.ts` runs axe over a rendered part.

## The demo's data

- **`pnpm data:fetch`** refreshes the products from mock.shop into `demo/data/mock-shop.json`.
- **`pnpm data:generate`** turns them into the demo's catalog and orders, seeded so the result is always the same.
