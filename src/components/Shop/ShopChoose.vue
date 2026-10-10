<script setup lang="ts">
import { computed } from 'vue'
import { RoutePath } from '@/router/routePath'
import { useAuth } from '@/auth/useAuth'

const { user } = useAuth()

const baseOptions = [
  { to: RoutePath.Shopping, icon: '🛍️', label: 'Einkaufen' },
  { to: RoutePath.ShoppingList, icon: '📝', label: 'Aktuelle Liste' },
  { to: RoutePath.ShoppingOverview, icon: '📊', label: 'Übersicht' },
]

// Die Shopliste (Artikelverwaltung) sehen nur Admins.
const options = computed(() =>
  user.value?.isAdmin
    ? [...baseOptions, { to: RoutePath.ShopItems, icon: '🗂️', label: 'Shopliste' }]
    : baseOptions,
)
</script>

<template>
  <div class="page-section">
    <h1 class="page-title">Shop</h1>

    <nav class="options" aria-label="Shop">
      <router-link
        v-for="option in options"
        :key="option.to"
        :to="option.to"
        class="option glass-card"
      >
        <span class="icon" aria-hidden="true">{{ option.icon }}</span>
        <span class="label">{{ option.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped lang="scss">
.options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  max-width: 720px;
  margin: 0 auto;
}

.option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 140px;
  padding: 1.5rem 1rem;

  text-decoration: none;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  .icon {
    font-size: 2.5rem;
    line-height: 1;
  }

  .label {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--c-accent);
  }

  &:hover {
    transform: translateY(-4px);
    border-color: var(--c-border-strong);
    box-shadow: var(--shadow-card), var(--glow);
  }
}

/* 📱 MOBILE: kompakte Zeilen statt großer Kacheln */
@media (max-width: 600px) {
  .options {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .option {
    flex-direction: row;
    justify-content: flex-start;
    gap: 1rem;
    min-height: 64px;
    padding: 0.9rem 1.25rem;

    .icon {
      font-size: 1.75rem;
    }
  }
}
</style>
