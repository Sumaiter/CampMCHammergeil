<template>
  <footer class="footer">
    <div class="footer-inner">
      <p class="brand">Camp MC Hammergeil</p>

      <div class="links">
        <RouterLink to="/impressum">Impressum</RouterLink>
        <span>•</span>
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
.footer {
  width: 100%;
  padding: 3vh 4vw;
  margin-top: 6vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  text-align: center;
  color: white;
}

.brand {
  font-family: 'Metal Mania', cursive;
  color: #78ffc8;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin-bottom: 1vh;
}

.links {
  display: flex;
  justify-content: center;
  gap: 0.8rem;
  font-size: 0.85rem;
}

.links a {
  color: white;
  text-decoration: none;
  opacity: 0.8;
}

.links a:hover {
  color: #78ffc8;
  opacity: 1;
}

.copy {
  margin-top: 1vh;
  font-size: 0.7rem;
  opacity: 0.5;
}
</style>
