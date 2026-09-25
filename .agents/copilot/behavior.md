# Copilot-Specific Behavior

## Suggestions

- Suggest completions consistent with the existing code style in the file
- Respect the Vue 3 `<script setup>` pattern — do not suggest Options API
- Use TypeScript strict typing in all suggestions — avoid `any`
- Follow the import order: Vue → third-party → @muzakit/* → local

## Component Suggestions

- When creating a new component, scaffold with `<script setup lang="ts">` first
- Props block with `defineProps<Props>()` and interface definition
- Emits block with typed `defineEmits`

## Do Not Suggest

- `Vue.component()` global registration
- `this` references (Options API)
- `require()` — use ESM `import`
- Default exports for composables — use named exports

## Skills Auto-Activation

Check `.agents/skills/` for applicable skills before completing a request.
Each skill has **Auto-Activation Triggers** — apply the skill automatically when they match.
