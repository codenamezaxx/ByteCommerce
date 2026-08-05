# P11.3 Frontend Testing — Design Spec

**Date**: 2026-08-05
**Phase**: P11 — Testing & QA (Frontend Tests)
**Approach**: Component-First (Bottom-Up)
**Stack**: Jest + React Testing Library + MSW v2

---

## 1. Goal

Add comprehensive frontend tests for all ByteCommerce Next.js components and pages using Jest + React Testing Library + MSW for API mocking. Target: full coverage of rendering, user interactions, loading/error states, and API integration.

## 2. File Structure

```
frontend/
├── __tests__/
│   ├── setup.ts                  # Global test setup (MSW server start, cleanup after each)
│   ├── mocks/
│   │   ├── handlers.ts           # MSW request handlers for all API routes
│   │   └── server.ts             # MSW server for Node.js environment
│   ├── components/
│   │   ├── Navbar.test.tsx
│   │   ├── Footer.test.tsx
│   │   ├── CountdownTimer.test.tsx
│   │   ├── ProductImage.test.tsx
│   │   ├── InvoiceCard.test.tsx
│   │   ├── Spinner.test.tsx
│   │   └── PhantomSkeleton.test.tsx
│   └── pages/
│       ├── Home.test.tsx
│       ├── Login.test.tsx
│       ├── Signup.test.tsx
│       ├── Cart.test.tsx
│       ├── Checkout.test.tsx
│       ├── ProductDetail.test.tsx
│       ├── Orders.test.tsx
│       ├── Profile.test.tsx
│       └── Admin.test.tsx
├── jest.config.js                 # Jest configuration for Next.js + TypeScript
└── package.json                   # Add test scripts + dev dependencies
```

## 3. Test Coverage Matrix

### Components (21 tests)

| Component | Tests | What We Verify |
|---|---|---|
| Navbar | 3 | Renders logo/links, auth state logged-in (shows profile/logout), auth state logged-out (shows login/signup) |
| Footer | 2 | Renders footer links, renders copyright text |
| CountdownTimer | 4 | Renders countdown values, counts down over time, shows expired state at 0, handles invalid/null date gracefully |
| ProductImage | 3 | Renders image with correct src, shows fallback placeholder on error, displays alt text |
| InvoiceCard | 3 | Renders order info (date, total, status), renders items list, shows correct status badge color |
| Spinner | 1 | Renders loading indicator |
| PhantomSkeleton | 1 | Renders skeleton placeholders |

### Pages (34 tests)

| Page | Tests | What We Verify |
|---|---|---|
| Home | 4 | Loads and displays products, shows flash sale banner when active, category filter updates list, triggers load-more on scroll |
| Login | 4 | Renders login form, submits credentials to API, displays error on wrong password, navigates to signup link |
| Signup | 4 | Renders signup form, validates required fields, submits registration, displays error on duplicate email |
| Cart | 5 | Loads cart items, adds item to cart, removes item from cart, updates quantity, shows empty state when cart is empty |
| Checkout | 4 | Loads cart items for checkout, renders shipping form, payment method selection, submits order successfully |
| ProductDetail | 4 | Loads product details, displays flash sale info when active, add-to-cart button works, shows out-of-stock state |
| Orders | 3 | Loads order list, renders pagination, shows empty state when no orders |
| Profile | 3 | Loads user profile data, tab switching works, saves profile updates |
| Admin | 3 | Dashboard loads metrics, flash sale list renders, product management renders |

**Total: ~55 tests across 16 files**

## 4. MSW Mock Handlers

All API endpoints mocked:

```
Auth:       POST /api/auth/login, POST /api/auth/signup, POST /api/auth/logout, GET /api/auth/me
Products:   GET /api/products, GET /api/products/:id
Cart:       GET /api/cart, POST /api/cart/items, PUT /api/cart/items/:id, DELETE /api/cart/items/:id
Flash Sale: GET /api/flash-sale/active, POST /api/flash-sale/checkout
Orders:     GET /api/orders, GET /api/orders/:id
Admin:      GET /api/admin/dashboard
```

Each handler returns standardized `{ success: true, data: {...} }` or `{ success: false, message: "...", code: "..." }` format matching the backend API contract.

## 5. Setup & Configuration

### Dependencies to Install
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event msw ts-jest @types/jest identity-obj-proxy
```

### jest.config.js
- Uses `next/jest` preset for Next.js compatibility
- `setupFilesAfterSetup`: `__tests__/setup.ts`
- Module name mapper for CSS modules (`identity-obj-proxy`)
- TypeScript support via `ts-jest`
- Test environment: `jsdom`

### setup.ts
- Import `@testing-library/jest-dom` matchers
- Start MSW server before all tests
- Close MSW server after all tests
- Cleanup DOM after each test

## 6. Execution Order

1. **Phase A**: Install dependencies + create jest.config + setup.ts + MSW server/handlers (~5 files)
2. **Phase B**: Test 7 components (~21 tests)
3. **Phase C**: Test 9 pages (~34 tests)
4. **Phase D**: Run `npm test` — verify all green

## 7. Success Criteria

- [ ] `npm test` passes with 0 failures
- [ ] All 16 test files created
- [ ] All ~55 test cases passing
- [ ] MSW handlers cover all API routes used by frontend
- [ ] No test uses real API calls — everything mocked
