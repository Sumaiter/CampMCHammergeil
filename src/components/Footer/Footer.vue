<script setup lang="ts">
import { routerHelper } from '@/router/routerHelper'
import { RoutePath } from '@/router/routePath'
const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">
    <div class="footer-inner">
      <p class="brand">Camp MC Hammergeil</p>
      <div class="links">
        <span @click="routerHelper.goTo(RoutePath.Imprint)">Impressum</span>
        <span class="dot">•</span>
        <span @click="routerHelper.goTo(RoutePath.PrivacyPolicy)">Datenschutz</span>
        <span class="dot">•</span>
        <span @click="routerHelper.goTo(RoutePath.Credits)">Quellen & Bildrechte</span>
      </div>
      <p class="copy">© {{ year }}</p>
    </div>
  </footer>
</template>

<style scoped lang="scss">
/* 🌍 FOOTER WRAPPER */
.footer {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: clamp(12px, 3vh, 28px) clamp(12px, 4vw, 40px);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  text-align: center;
  color: white;

  /* 🧱 INNER */
  .footer-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(6px, 1.5vh, 12px);

    /* 🟢 BRAND */
    .brand {
      font-family: 'Metal Mania', cursive;
      color: #78ffc8;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-size: clamp(1rem, 3.5vw, 1.4rem);
    }

    /* 🔗 LINKS */
    .links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 10px;
      font-size: clamp(0.75rem, 2.5vw, 0.9rem);

      a {
        color: white;
        text-decoration: none;
        opacity: 0.8;
        padding: 4px 6px;
        border-radius: 6px;
        transition: 0.2s ease;

        &:hover {
          color: #78ffc8;
          opacity: 1;
        }
      }
    }

    /* 🟣 DOT */
    .dot {
      opacity: 0.5;
    }

    /* © */
    .copy {
      font-size: clamp(0.65rem, 2vw, 0.8rem);
      opacity: 0.5;
    }
  }
}

/* 📱 SMALL FIX */
@media (max-width: 480px) {
  .footer {
    .footer-inner {
      .links {
        flex-direction: column;
        gap: 6px;
      }

      .dot {
        display: none;
      }
    }
  }
}
</style>
