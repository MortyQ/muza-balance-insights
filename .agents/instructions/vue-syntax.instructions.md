---
applyTo: "**/*.vue"
---

# Vue Syntax Rules

> These rules are hard constraints. Every rule is verified during code review.
> All code must use Vue 3.5+ APIs. Legacy Vue 3.0–3.3 patterns are banned.

---

## Rule 1 — Script Setup Always

Every component uses `<script setup lang="ts">`. No Options API, no `export default {}`, no `<script>` without `setup`.

```vue
<!-- ✅ correct -->
<script setup lang="ts">
  const props =
  ...
</script>

<!-- ❌ wrong -->
<script lang="ts">
  export default defineComponent({
    setup() { ...
    }
  })
</script>
```

---

## Rule 2 — Reactive Destructuring for Props (Vue 3.5+)

Destructure props directly from `defineProps`. Default values are inline in the destructuring.
In Vue 3.5+ the compiler preserves reactivity on destructured props — accessing them via `props.x` is banned.

```ts
// ✅ correct
const {title, count = 0, items = []} = defineProps<{
    title: string
    count?: number
    items?: Product[]
}>()

// ✅ correct — getter pattern when passing to a composable
const {query} = defineProps<{ query: string }>()
useSearch(() => query) // pass as getter, not raw value

// ❌ wrong — assigning to a variable and accessing via props.x
const props = defineProps<{ title: string; count?: number }>()
// props.title, props.count — banned
```

---

## Rule 3 — defineModel for Two-Way Binding

Use `defineModel` for all v-model bindings. Never manually declare `modelValue` prop + `update:modelValue` emit.

```ts
// ✅ correct — single model
const value = defineModel<string>()

// ✅ correct — named model
const visible = defineModel<boolean>('visible')

// ✅ correct — with transformer
const count = defineModel<number>('count', {
    set(val) {
        return Math.max(0, val)
    }
})

// ❌ wrong — legacy v-model pattern
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
```

---

## Rule 4 — useTemplateRef for DOM/Component References

Use `useTemplateRef` for all template refs. Never use `ref<HTMLElement | null>(null)` for DOM references.
The string key must exactly match the `ref="..."` attribute in the template.

```ts
// ✅ correct
const inputEl = useTemplateRef<HTMLInputElement>('input')
const tabsRef = useTemplateRef<{ currentTabId: string }>('tabs')

// ❌ wrong
const inputEl = ref<HTMLInputElement | null>(null)
```

---

## Rule 5 — useId for Accessible Form IDs

Use `useId()` for form label/input pairs. Never generate IDs with `Math.random()`, `Date.now()`, or manual counters.

```ts
// ✅ correct
const id = useId()
```

```vue
<!-- ✅ correct -->
<label :for="id">Product name</label>
<input :id="id" v-model="name"/>
```

---

## Rule 6 — onWatcherCleanup for Watcher Side Effects

Use `onWatcherCleanup` inside `watch` / `watchEffect` callbacks for cleanup. The old `onCleanup` parameter is banned.

```ts
// ✅ correct
watch(query, (newQuery) => {
    const controller = new AbortController()
    onWatcherCleanup(() => controller.abort())
    fetchProducts(newQuery, controller.signal)
})

// ❌ wrong — old Vue 3.0–3.3 signature
watch(query, (newQuery, _old, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
})
```

---

## Rule 7 — v-bind Shorthand (Vue 3.4+)

When the variable name matches the prop name exactly, use `:name` shorthand. Never write `:name="name"`.

```vue
<!-- ✅ correct -->
<ProductTable :items :loading :error/>

<!-- ❌ wrong -->
<ProductTable :items="items" :loading="loading" :error="error"/>
```

---

## Rule 8 — defineAsyncComponent for Non-Critical Components

Use `defineAsyncComponent` for components not needed on initial render: heavy charts, modals, off-screen panels,
drawers.
Always provide `loadingComponent`, `errorComponent`, and `delay` to prevent flicker on fast loads.

```ts
// ✅ correct
const ProductMediaGallery = defineAsyncComponent({
    loader: () => import('./components/ProductMediaGallery.vue'),
    loadingComponent: Spinner,
    errorComponent: ErrorBlock,
    delay: 200,
})

// ❌ wrong — no fallbacks
const ProductMediaGallery = defineAsyncComponent(
    () => import('./components/ProductMediaGallery.vue')
)
```

Do **not** use `defineAsyncComponent` for components always visible on page load.

---

## Rule 9 — v-memo for Expensive List Items

Apply `v-memo` only to list items with genuinely expensive renders. Never apply blindly.

```vue
<!-- ✅ correct — only re-render when these values change -->
<ProductRow
    v-for="product in products"
    :key="product.id"
    v-memo="[product.updatedAt, product.status]"
    :product
/>

<!-- ❌ wrong — applied to simple text rows -->
<li v-for="tag in tags" :key="tag.id" v-memo="[tag.name]">{{ tag.name }}</li>
```

---

## Rule 10 — watch vs watchEffect

`watch` is the default. It has explicit, predictable dependencies and supports old/new value comparison.
Use `watchEffect` only when there are multiple obvious dependencies and no need for the old value.

```ts
// ✅ correct — watch: explicit source, predictable
watch(
    () => filtersStore.selectedBrandIds,
    () => {
        loadProducts()
    },
    {immediate: true}
)

// ✅ correct — watchEffect: multiple obvious deps, no comparison needed
watchEffect(() => {
    if (!filtersStore.isInitialized) return
    loadProducts()
})

// ❌ wrong — watchEffect with async body: only deps before first await are tracked
watchEffect(async () => {
    const result = await fetch(`/api/products?brand=${filtersStore.brandId}`)
    // filtersStore.brandId IS tracked (before await)
    // anything after await is NOT tracked — silent bug
})
```

**Rule of thumb:** If you write `async` inside `watchEffect` — switch to `watch`.

---

## Rule 11 — Typed Emits with Tuple Syntax

All emits use typed `defineEmits` with the tuple notation.

```ts
// ✅ correct
const emit = defineEmits<{
    select: [item: Product]
    delete: [id: string]
    'update:filters': [filters: ProductFilters]
}>()

// ❌ wrong
const emit = defineEmits(['select', 'delete', 'update:filters'])
```

---

## Rule 12 — defineOptions for Recursive Components

Use `defineOptions({ name: 'ComponentName' })` only when the component is recursive. Not required on every component.

---

## Rule 13 — No $refs, $parent, $emit in Composition API

Never access `$refs`, `$parent`, or `$emit` in `<script setup>`. Use `useTemplateRef`, props/emits, or provide/inject.

---

## Rule 14 — Component File Structure

Always in this order: `<script>` → `<template>` → `<style>`. No exceptions.

```vue
<!-- ✅ correct -->
<script setup lang="ts">
  // logic
</script>

<template>
  <!-- markup -->
</template>

<style scoped>
  /* styles */
</style>

<!-- ❌ wrong — template first, style before script, etc. -->
```

---

## Rule 15 — Scoped Styles Always

Every component uses `<style scoped>`. Global styles belong only in `main.css` / design tokens files — never in a
component.

```vue
<!-- ✅ correct -->
<style scoped>
  .product-card {
    ...
  }
</style>

<!-- ❌ wrong — unscoped in component file -->
<style>
  .product-card {
    ...
  }
</style>
```

Use `:deep()` sparingly — only when overriding styles of a third-party or library child component that cannot be reached
otherwise.

```vue
<!-- ✅ acceptable — overriding library internals -->
<style scoped>
  :deep(.v-input__control) {
    border-radius: 8px;
  }
</style>

<!-- ❌ wrong — using :deep() to avoid scoping your own components -->
<style scoped>
  :deep(.my-own-component-class) {
    ...
  }
</style>
```

No inline styles. Use CSS variables or class bindings for dynamic values.

```vue
<!-- ✅ correct — dynamic via CSS var -->
<div :style="{ '--progress': `${percent}%` }" class="progress-bar"/>

<!-- ❌ wrong — inline styles -->
<div :style="{ width: percent + '%', backgroundColor: color }"/>
```

---

## Rule 16 — Composables

### Naming & location

- Prefix: always `use` — `useProductFilters`, `useTableSelection`
- Location: `src/composables/` for shared logic, co-locate with component if single-use

### Parameters — accept `MaybeRefOrGetter<T>`

Composables that receive external values must accept refs, getters, or raw values interchangeably via
`MaybeRefOrGetter<T>` + `toValue()`.

```ts
// ✅ correct — flexible input
import {toValue, type MaybeRefOrGetter} from 'vue'

export function useProductSearch(query: MaybeRefOrGetter<string>) {
    const results = ref<Product[]>([])

    watchEffect(() => {
        const q = toValue(query) // handles ref / getter / raw value
        if (!q) return
        fetchSearch(q).then(r => results.value = r)
    })

    return {results}
}

// All of these work:
useProductSearch('iphone')
useProductSearch(ref('iphone'))
useProductSearch(() => searchQuery.value)

// ❌ wrong — only accepts raw value, breaks reactivity
export function useProductSearch(query: string) { ...
}
```

### Return value

Always return a plain object with named refs or computed. Never return a `reactive()` object — it loses type inference
on destructuring.

```ts
// ✅ correct
return {items, isLoading, error, refresh}

// ❌ wrong — reactive() breaks destructuring reactivity
return reactive({items, isLoading})
```

### Cleanup

Register cleanup inside the composable — not in the calling component.

```ts
// ✅ correct — composable owns its cleanup
export function useResizeObserver(target: MaybeRefOrGetter<HTMLElement | null>) {
    const width = ref(0)

    const ro = new ResizeObserver(([entry]) => {
        width.value = entry.contentRect.width
    })

    watchEffect(() => {
        const el = toValue(target)
        if (el) ro.observe(el)
    })

    onUnmounted(() => ro.disconnect())

    return {width}
}
```

### TypeScript — explicit return type

Always annotate the return type on shared composables.

```ts
// ✅ correct
export function useProductFilters(): {
    filters: Ref<ProductFilters>
    reset: () => void
    apply: (f: Partial<ProductFilters>) => void
} { ...
}
```

### Single responsibility

One composable = one concern. If it does data fetching + filtering + sorting — split it.

```ts
// ✅ correct
useProductFilters()   // filter state only
useProductSort()      // sort state only
useProductList()      // fetching, combines the above

// ❌ wrong — one god-composable for everything
useProductPage()
```

### No top-level side effects

Side effects (fetch, subscriptions, DOM access) go inside lifecycle hooks or watchers — not at the top level of the
composable function.

```ts
// ✅ correct
export function useData() {
    const data = ref(null)
    onMounted(() => fetchData().then(r => data.value = r))
    return {data}
}

// ❌ wrong — side effect fires at call time, breaks SSR and tests
export function useData() {
    const data = ref(null)
    fetchData().then(r => data.value = r) // called immediately
    return {data}
}
```

---

## Rule 17 — Pinia: Setup Store Syntax

Use setup store syntax exclusively. Options syntax is banned.

### Store definition

```ts
// ✅ correct — setup store
export const useProductsStore = defineStore('products', () => {
    // ref() → state
    const items = ref<Product[]>([])
    const isLoading = ref(false)

    // computed() → getters
    const count = computed(() => items.value.length)
    const published = computed(() => items.value.filter(p => p.status === 'published'))

    // function() → actions
    async function fetchProducts(filters: ProductFilters) {
        isLoading.value = true
        try {
            items.value = await api.products.list(filters)
        } finally {
            isLoading.value = false
        }
    }

    function reset() {
        items.value = []
    }

    // ⚠️ must return ALL state — Pinia requires it for devtools / SSR
    return {items, isLoading, count, published, fetchProducts, reset}
})

// ❌ wrong — options syntax
export const useProductsStore = defineStore('products', {
    state: () => ({items: []}),
    actions: {
        fetchProducts() { ...
        }
    }
})
```

### Using stores in components

```ts
// ✅ correct
const productsStore = useProductsStore()

// state + getters — destructure via storeToRefs (stays reactive)
const {items, isLoading, count} = storeToRefs(productsStore)

// actions — destructure directly (functions, no reactivity needed)
const {fetchProducts, reset} = productsStore

// ❌ wrong — destructuring state without storeToRefs loses reactivity
const {items, isLoading} = productsStore // items is now a plain array, not reactive
```

### $patch for multiple state mutations

```ts
// ✅ correct — batch update via $patch
productsStore.$patch({
    isLoading: false,
    items: [],
})

// ✅ also correct — $patch with callback for complex mutations
productsStore.$patch((state) => {
    state.items = state.items.filter(p => p.id !== deletedId)
    state.totalCount--
})
```

---

## Key Patterns

- **Tab ref access** — `useTemplateRef<{ currentTabId: string }>('tabs')`
- **useDebounceFn on filter watch** — debounce rapid filter changes before triggering data loads
- **KeepAlive on tab-switched components** — preserve state on heavy tab content
- **shallowRef for static tab arrays** — `const tabs = shallowRef([...])` avoids deep reactivity on static config
