<script setup lang="ts">
import { ref, watch } from 'vue'

// Mengenfeld mit − und + (touch-freundlich); Tippen einer Zahl funktioniert ebenfalls
const props = withDefaults(
  defineProps<{ min?: number; max?: number; label?: string; disabled?: boolean }>(),
  {
    min: 0,
    max: Number.POSITIVE_INFINITY,
    label: 'Anzahl',
    disabled: false,
  },
)
const model = defineModel<number>({ default: 0 })

function clamp(value: number): number {
  return Math.min(props.max, Math.max(props.min, Math.floor(value)))
}

// Angezeigter Text; darf beim Tippen kurz leer sein
const text = ref(String(clamp(model.value)))
watch(model, (value) => {
  if (Number(text.value) !== value) text.value = String(value)
})

function set(value: number) {
  const next = clamp(value)
  text.value = String(next)
  model.value = next
}

function onInput(event: Event) {
  const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '')
  if (digits === '') {
    text.value = ''
    return
  }
  set(Number(digits))
  ;(event.target as HTMLInputElement).value = text.value
}

// Beim Verlassen: leere/ungültige Eingabe auf den Mindestwert setzen
function onBlur() {
  set(text.value === '' ? props.min : Number(text.value))
}
</script>

<template>
  <div class="stepper">
    <button
      type="button"
      class="stepper-btn"
      :aria-label="`${label} verringern`"
      :disabled="disabled || model <= min"
      @click="set(model - 1)"
    >
      −
    </button>
    <input
      class="form-input stepper-input"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      autocomplete="off"
      :aria-label="label"
      :value="text"
      :disabled="disabled"
      @input="onInput"
      @blur="onBlur"
    />
    <button
      type="button"
      class="stepper-btn"
      :aria-label="`${label} erhöhen`"
      :disabled="disabled || model >= max"
      @click="set(model + 1)"
    >
      +
    </button>
  </div>
</template>

<style scoped lang="scss">
.stepper {
  display: inline-grid;
  grid-template-columns: 44px 3.5rem 44px;
  align-items: stretch;
  gap: 0.35rem;
}

.stepper-btn {
  min-height: 44px;
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--c-accent);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.2s ease,
    opacity 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(120, 255, 200, 0.12);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.stepper-input {
  min-height: 44px;
  padding: 0.4rem 0.25rem;
  text-align: center;
}
</style>
