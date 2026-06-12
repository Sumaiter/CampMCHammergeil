<template>
  <footer class="footer">
    <div class="footer-inner">
      <p class="brand">Camp MC Hammergeil</p>

      <div class="links">
        <RouterLink to="/impressum">Impressum</RouterLink>
        <span class="dot">•</span>
        <RouterLink to="/datenschutz">Datenschutz</RouterLink>
      </div>

      <p class="copy">© {{ year }}</p>
    </div>
  </footer>
</template>

<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<style scoped>
/* 🌍 FOOTER WRAPPER */
.footer {
  width: 100%;

  padding: clamp(12px, 3vh, 28px) clamp(12px, 4vw, 40px);

  margin-top: clamp(20px, 6vh, 60px);

  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);

  text-align: center;
  color: white;
}

/* 🧱 INNER */
.footer-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(6px, 1.5vh, 12px);
}

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
}

.links a {
  color: white;
  text-decoration: none;

  opacity: 0.8;

  padding: 4px 6px;
  border-radius: 6px;

  transition: 0.2s ease;
}

.links a:hover {
  color: #78ffc8;
  opacity: 1;
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

/* 📱 SMALL FIX */
@media (max-width: 480px) {
  .links {
    flex-direction: column;
    gap: 6px;
  }

  .dot {
    display: none;
  }
}
</style>
