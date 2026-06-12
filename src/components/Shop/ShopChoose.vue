<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()

const goShopping = () => {
  router.push('/shopping')
}
const goShoppingList = () => {
  router.push('/shoppinglist')
}
const goShoppingOverview = () => {
  router.push('/shoppingoverview')
}
</script>
<template>
  <div class="shop-choose">
    <h2>Shop</h2>

    <div class="buttons">
      <button class="shopButton" @click.stop="goShopping">Einkaufen</button>

      <button class="shopButton" @click.stop="goShoppingList">Aktuelle Liste</button>

      <button class="shopButton" @click.stop="goShoppingOverview">Übersicht</button>
    </div>
    <router-view />
  </div>
</template>

<style scoped>
.shop-choose {
  color: white;
  text-align: center;
  margin-top: 60px;
}

/* Container wie Cookie Buttons */
.buttons {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  max-width: 220px;
  margin: 30px auto;
}

/* Basis Button Style */
.shopButton {
  padding: 0.8rem 1rem;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  border: none;
  transition: 0.2s ease;

  backdrop-filter: blur(10px);
  font-size: 0.95rem;

  background: rgba(120, 255, 200, 0.15);
  color: #78ffc8;
  border: 1px solid rgba(120, 255, 200, 0.3);
}

/* Hover Effekt wie Cookie-Bar */
button:hover {
  opacity: 0.9;
  transform: scale(1.1);
}

/* Mobile tweak */
@media (max-width: 480px) {
  .buttons {
    max-width: 90%;
  }
}
</style>
