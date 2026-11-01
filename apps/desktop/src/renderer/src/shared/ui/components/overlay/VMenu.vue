<!-- built on reka-ui (2026-11-01): DropdownMenu. Ours, not copied: muzakit has no menu.
     An icon trigger (label → aria-label) opening a list of actions; arrows move, Enter picks, Esc and a click outside
     close it, focus returns to the trigger. VContextMenu offers the same list on a right click. -->
<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from "reka-ui";
import VIcon from "../base/VIcon.vue";
import type { MenuItem } from "./menu";

const { items, label, icon = "lucide:ellipsis-vertical" } = defineProps<{
  items: ReadonlyArray<MenuItem>;
  /** The trigger's accessible name. */
  label: string;
  icon?: string;
}>();
const emit = defineEmits<{ select: [id: string] }>();
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="v-menu__trigger" :aria-label="label">
      <VIcon :icon class="v-menu__trigger-icon" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent as-child align="end" :side-offset="4">
        <div class="v-menu">
          <DropdownMenuItem v-for="item in items" :key="item.id" class="v-menu__item" @select="emit('select', item.id)">
            <VIcon v-if="item.icon" :icon="item.icon" class="v-menu__item-icon" />
            <span>{{ item.text }}</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style lang="scss" scoped>
@use "../../styles/components/overlay/vmenu.scss";
</style>
