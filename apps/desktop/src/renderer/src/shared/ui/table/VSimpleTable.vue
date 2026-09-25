<script setup lang="ts" generic="Row">
import type { TableColumn, TableFooterCell } from "./types";

const { columns, rows, rowKey, footer = [] } = defineProps<{
  columns: ReadonlyArray<TableColumn<Row>>
  rows: ReadonlyArray<Row>
  rowKey: (row: Row) => string | number
  /** A total row under the body; cells may span columns. */
  footer?: ReadonlyArray<TableFooterCell>
}>();

defineSlots<{
  [cell: `cell-${string}`]: (props: { row: Row; value: string }) => unknown
}>();

const cellClass = (c: TableColumn<Row>) => ({
  "v-simple-table__cell--end": c.align === "end",
  "v-simple-table__cell--secondary": c.tone === "secondary",
  "v-simple-table__cell--strong": c.strong === true,
});
const widthVar = (c: TableColumn<Row>) => (c.width ? { "--v-simple-table-col-width": c.width } : undefined);
</script>

<template>
  <table class="v-simple-table">
    <thead>
      <tr>
        <th
          v-for="c in columns"
          :key="c.key"
          :class="{ 'v-simple-table__cell--end': c.align === 'end' }"
          :style="widthVar(c)"
          class="v-simple-table__th"
        >
          <span :class="{ 'v-simple-table__sr-only': c.hideLabel }">{{ c.label }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="rowKey(row)"
      >
        <td
          v-for="c in columns"
          :key="c.key"
          :class="cellClass(c)"
          class="v-simple-table__td"
        >
          <slot
            :name="`cell-${c.key}`"
            :row
            :value="c.value?.(row) ?? ''"
          >
            {{ c.value?.(row) }}
          </slot>
        </td>
      </tr>
    </tbody>
    <tfoot v-if="footer.length > 0">
      <tr>
        <td
          v-for="(cell, i) in footer"
          :key="i"
          :colspan="cell.colspan"
          :class="{ 'v-simple-table__cell--end': cell.align === 'end' }"
          class="v-simple-table__foot-td"
        >
          {{ cell.text }}
        </td>
      </tr>
    </tfoot>
  </table>
</template>

<style lang="scss" scoped>
@use "./vsimpletable.scss";
</style>
