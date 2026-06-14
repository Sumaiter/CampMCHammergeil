<script setup lang="ts">
import { routerHelper } from '@/router/routerHelper'
import { RoutePath } from '@/router/routePath'
</script>

<template>
  <div class="shop-choose">
    <h2>Shop</h2>

    <div class="buttons">
      <button class="shopButton" @click.stop="routerHelper.goTo(RoutePath.Shopping)">
        Einkaufen
      </button>

      <button class="shopButton" @click.stop="routerHelper.goTo(RoutePath.ShoppingList)">
        Aktuelle Liste
      </button>

      <button class="shopButton" @click.stop="routerHelper.goTo(RoutePath.ShoppingOverview)">
        Übersicht
      </button>
    </div>
    <router-view />
  </div>
</template>

<style scoped lang="scss">
.shop-choose {
  color: white;
  text-align: center;
  margin-top: 60px;

  .buttons {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    max-width: 220px;
    margin: 30px auto;

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

      &:hover {
        opacity: 0.9;
        transform: scale(1.1);
      }
    }
  }
}

@media (max-width: 480px) {
  .shop-choose {
    .buttons {
      max-width: 90%;
    }
  }
}
</style>
