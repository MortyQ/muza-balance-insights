---
applyTo: "**/*.ts,**/*.vue"
---

# TypeScript Rules

> These rules are hard constraints. No degradation of type safety is allowed.
> TypeScript strict mode is always on. Every rule is verifiable in code review.

---

## Rule 1 — Strict Mode Always On

`tsconfig.json` must have `"strict": true`. Never disable it, never override individual strict flags.

```json
// ✅ correct
{
  "compilerOptions": {
    "strict": true
  }
}

// ❌ wrong — disabling individual strict flags
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": false,
    "strictNullChecks": false
  }
}
```

---

## Rule 2 — No `any`

`any` is banned. Use `unknown` with a type guard for truly unknown data.
Use proper generics for reusable functions.

```ts
// ✅ correct — unknown + type guard
function processWebhookPayload(raw: unknown) {
  if (!isProductPayload(raw)) throw new Error('Unexpected payload')
  return raw.id
}

function isProductPayload(val: unknown): val is { id: string; name: string } {
  return typeof val === 'object' && val !== null && 'id' in val
}

// ❌ wrong — any to silence TS
function doSomething(handler: any) {
  handler()
}

// ❌ wrong — cast to any to bypass check
const id = (row as any).id
```

---

## Rule 3 — No Regular Enums

Regular TypeScript `enum` is banned — it generates runtime code and hurts tree-shaking.
Use union types or const objects.

```ts
// ✅ correct — union type (preferred when no iteration needed)
type ProductStatus = 'active' | 'inactive' | 'archived'
type MediaType = 'image' | 'video' | 'document'

// ✅ correct — const object with satisfies (when iteration or Object.values() is needed)
const PRODUCT_STATUS = {
  Active: 'active',
  Inactive: 'inactive',
  Archived: 'archived',
} as const satisfies Record<string, string>

type ProductStatus = typeof PRODUCT_STATUS[keyof typeof PRODUCT_STATUS]
// iterate: Object.values(PRODUCT_STATUS)

// ❌ wrong — regular enum
enum ProductStatus {
  Active = 'active',
  Inactive = 'inactive',
  Archived = 'archived',
}

// ❌ wrong — numeric enum
enum Direction { Up, Down, Left, Right }
```

> Note: GQL codegen may produce enums from the schema — those are allowed since they come from generated code.
> Do not replicate them manually.

---

## Rule 4 — `import type` for Type-Only Imports

All type-only imports use `import type`. Prevents accidental runtime imports and avoids circular dependency issues.

```ts
// ✅ correct
import type { Product, ProductStatus, ProductFiltersInput } from '@/gql/generated'
import type { Ref, ComputedRef } from 'vue'
import type { ApolloError } from '@apollo/client/core'

// ❌ wrong — importing types without `import type`
import { Product, ProductStatus } from '@/gql/generated'
import { Ref } from 'vue'
```

---

## Rule 5 — Explicit Return Types on Exported Composables

All exported composables must have an explicit return type — either inline or via a named interface.
No exceptions: TypeScript inference, however accurate, is not a substitute for a documented contract.

```ts
// ✅ correct — named interface (preferred for complex returns)
interface UseProductsReturn {
  products: ComputedRef<Product[]>
  total: ComputedRef<number>
  loading: Ref<boolean>
  error: Ref<ApolloError | null>
  isEmpty: ComputedRef<boolean>
  refetch: () => void
}

export function useProducts(): UseProductsReturn {
  // ...
}

// ✅ correct — inline for simple composables
export function useToggle(initial = false): { value: Ref<boolean>; toggle: () => void } {
  const value = ref(initial)
  const toggle = () => { value.value = !value.value }
  return { value, toggle }
}

// ❌ wrong — no return type on exported composable
export function useProducts() {
  const { result } = useProductsQuery()
  return { products: computed(() => result.value?.products.items ?? []) }
}
```

---

## Rule 6 — Nullability: `null` over `undefined` for Intentional Absence

Use `null` when a value is intentionally absent.
Use `undefined` only when a value has never been set or is an optional function param.

```ts
// ✅ correct — intentional absence is null
const selectedProductId = ref<string | null>(null)
const product = ref<Product | null>(null)

// ✅ correct — optional param uses undefined implicitly
function useProducts(filters?: Ref<ProductFiltersInput>) { ... }

// ❌ wrong — undefined for state that represents "nothing selected"
const selectedProductId = ref<string | undefined>(undefined)
```

---

## Rule 7 — Non-null Assertion `!`

`!` is allowed **only** when lifecycle guarantees existence — inside `onMounted`, `onUpdated`, or `onDone` callbacks.
Never use `!` to silence TypeScript outside of these boundaries.
After a null guard (`if (!x) return`), TypeScript narrows the type automatically — `!` is redundant and banned.

```ts
// ✅ correct — lifecycle guarantees DOM is mounted
onMounted(() => {
  inputRef.value!.focus()
})

// ✅ correct — TypeScript narrows automatically, no ! needed
if (!product.value) return
const name = product.value.name // TS already knows it's non-null here

// ❌ wrong — ! after a guard is redundant and misleading
if (!product.value) return
const name = product.value!.name // banned

// ❌ wrong — no lifecycle guarantee
const id = selectedProduct.value!.id
```

---

## Rule 8 — No `as` Type Assertions to Bypass Checks

`as` is banned for silencing TypeScript. It is allowed only for DOM ref access inside lifecycle hooks where
the type is known by construction. Any other use requires explicit justification in a comment.

```ts
// ✅ correct — DOM type known by construction inside onMounted
onMounted(() => {
  inputRef.value!.focus() // useTemplateRef<HTMLInputElement> — no `as` needed
})

// ✅ correct — narrowing after discriminant check
if (state.status !== 'success') return
const data = state.data // TS knows the type from discriminated union

// ❌ wrong — as to bypass a missing type
const id = (row as any).id

// ❌ wrong — as without a real guarantee
const product = someValue as Product
```

---

## Rule 9 — `interface` vs `type`

Use `interface` for domain entity shapes that may be extended.
Use `type` for unions, intersections, utility type compositions, and mapped types.

```ts
// ✅ correct — interface for domain entities
interface Product {
  id: string
  name: string
  status: ProductStatus
  categories: Category[]
}

// ✅ correct — type for unions, intersections, utility compositions
type ProductStatus = 'active' | 'inactive' | 'archived'
type ProductWithCategory = Product & { primaryCategory: Category }
type PartialProduct = Partial<Pick<Product, 'name' | 'status'>>

// ❌ wrong — type for plain extensible object shape
type Product = {
  id: string
  name: string
}
```

---

## Rule 10 — Generic Constraints

Always constrain generic type parameters when the shape is known.
Unconstrained `<T>` where a shape constraint is possible is banned.

```ts
// ✅ correct
function getById<T extends { id: string }>(list: T[], id: string): T | undefined {
    return list.find(item => item.id === id)
}

// ❌ wrong — unconstrained when shape is known
function getById<T>(list: T[], id: string): T | undefined {
    return (list as any[]).find(item => item.id === id)
}
```

---

## Rule 11 — Typed Props with `defineProps` Generic Syntax

Always use generic syntax for `defineProps`. Never use runtime object syntax.

```ts
// ✅ correct
const { products, loading, error } = defineProps<{
  products: ReadonlyArray<Product>
  loading: boolean
  error: ApolloError | null
}>()

// ❌ wrong — runtime object syntax
const props = defineProps({
  products: Array,
  loading: Boolean,
  error: Object,
})
```

---

## Rule 12 — Typed `computed` with Explicit Generic

When a `computed` return type is ambiguous (nullable, union, complex), provide an explicit generic.

```ts
// ✅ correct — explicit generic prevents silent null escape
const selectedProduct = computed<Product | null>(() =>
  products.value.find(p => p.id === selectedId.value) ?? null
)

// ❌ wrong — inferred as Product | undefined
const selectedProduct = computed(() =>
  products.value.find(p => p.id === selectedId.value)
)
```

---

## Rule 13 — `satisfies` for Validated Literals

Use `satisfies` when you need type validation without widening the inferred type.
Prefer `satisfies` over `as const` alone when the shape must be verified.

```ts
// ✅ correct — satisfies validates shape AND preserves literal types
const ROUTES = {
  products: '/products',
  settings: '/settings',
  dashboard: '/dashboard',
} satisfies Record<string, string>

// ROUTES.products → '/products' (literal), not string

// ✅ correct — const object with satisfies for enum replacement
const PRODUCT_STATUS = {
  Active: 'active',
  Inactive: 'inactive',
  Archived: 'archived',
} as const satisfies Record<string, string>

// ✅ correct — satisfies on component config objects
const tableColumns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status', sortable: false },
] satisfies TableColumn[]
// individual entries preserve literal types for `key`

// ❌ wrong — as const alone: no shape validation, TS won't catch wrong values
const ROUTES = {
  products: 42, // TS silent — no validation
} as const
```

---

## Rule 14 — Discriminated Unions for Async State

Model async data as a discriminated union — not as three parallel `ref` variables.
Parallel `isLoading + data + error` refs allow invalid state combinations and force redundant null checks everywhere.

```ts
// ✅ correct — single source of truth, exhaustive narrowing
type AsyncState<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; error: Error }

const state = ref<AsyncState<Product[]>>({status: 'idle'})

// narrowing in template or composable:
if (state.value.status === 'success') {
    console.log(state.value.data) // TS knows `data` exists here
}

// ❌ wrong — invalid combinations possible (loading=true AND error!=null)
const data = ref<Product[] | null>(null)
const isLoading = ref(false)
const error = ref<Error | null>(null)
```

Apply to: data fetching composables, form submission state, any operation with loading/error phases.

---

## Rule 15 — `readonly` and `ReadonlyArray`

Mark props and shared state as readonly to prevent accidental mutation.
Use `ReadonlyArray<T>` for array props. Use `Readonly<T>` for object props that should not be mutated.

```ts
// ✅ correct — array prop is read-only
const {items} = defineProps<{
    items: ReadonlyArray<Product>
    config: Readonly<TableConfig>
}>()

// ✅ correct — readonly in composable return (signals intent)
export function useProductList(): {
    products: Readonly<Ref<ReadonlyArray<Product>>>
    loading: Ref<boolean>
} { ...
}

// ✅ correct — readonly tuple
function useSorted<T>(list: ReadonlyArray<T>): ReadonlyArray<T> { ...
}

// ❌ wrong — mutable array prop allows push/splice inside component
const {items} = defineProps<{ items: Product[] }>()
items.push(newProduct) // silently mutates parent data
```