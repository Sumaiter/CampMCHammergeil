<script setup lang="ts">
import { ref } from 'vue'
import { routerHelper } from '@/router/routerHelper'
import { RoutePath } from '@/router/routePath'

const user = ref('')
const password = ref('')
</script>

<template>
  <div class="page-section login-wrapper">
    <form class="login-card glass-card" @submit.prevent="routerHelper.goTo(RoutePath.Login)">
      <h1 class="page-title">Login</h1>

      <label class="field">
        <span>User</span>
        <input v-model="user" name="username" autocomplete="username" placeholder="User" />
      </label>

      <label class="field">
        <span>Passwort</span>
        <input
          v-model="password"
          name="password"
          type="password"
          autocomplete="current-password"
          placeholder="Passwort"
        />
      </label>

      <button type="submit">Login</button>
    </form>
  </div>
</template>

<style scoped lang="scss">
.login-wrapper {
  display: flex;
  justify-content: center;
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 380px;
  padding: clamp(1.5rem, 6vw, 2.25rem);

  .page-title {
    margin-bottom: 0.25rem;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  span {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--c-text-muted);
  }
}

input {
  width: 100%;
  min-height: 46px;
  padding: 0.7rem 0.9rem;

  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.35);

  font-size: 1rem; // ≥16px verhindert Auto-Zoom auf iOS
  color: var(--c-text);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &::placeholder {
    color: rgba(238, 244, 241, 0.35);
  }

  &:focus {
    outline: none;
    border-color: var(--c-accent);
    box-shadow: 0 0 0 3px rgba(120, 255, 200, 0.2);
  }
}

button {
  min-height: 48px;
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;

  border: none;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--c-accent-mid), var(--c-accent-deep));

  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    filter 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    filter: brightness(1.12);
    box-shadow: var(--glow);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}
</style>
