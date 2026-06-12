<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const warping = ref(false)

const goHome = () => {
  warping.value = true
  setTimeout(() => router.push('/'), 200)
}

const goLogin = () => {
  router.push('/login')
}
</script>

<template>
  <div class="scene">
    <!-- 🛰️ HUD -->
    <div class="hud">
      <div class="satellite" @click.stop="goLogin">
        🛰️
        <span class="sat-label">LOGIN</span>
      </div>
    </div>
    <!-- 🌍 CENTER -->
    <div class="center">
      <div class="planet" @click="goHome" :class="{ warp: warping }">
        <div class="flame-aura"></div>

        <div class="craters">
          <div class="crater c1"></div>
          <div class="crater c2"></div>
          <div class="crater c3"></div>
          <div class="crater c4"></div>
          <div class="crater c5"></div>
          <div class="crater c6"></div>
          <div class="crater c7"></div>
          <div class="crater c8"></div>
          <div class="crater c9"></div>
        </div>

        <div class="text-layer">
          <GlitchedElement>
            <p class="metal">
              Camp MC <br class="mobile-break" />
              Hammergeil
            </p>
          </GlitchedElement>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 🧭 ROOT */
.scene {
  width: 100%;
  position: relative;
}

/* 🛰️ HUD */
.hud {
  position: absolute;
  top: 0;
  right: 0;
  padding: 14px;
  z-index: 10;
}

.satellite {
  font-size: 3rem;
  cursor: pointer;

  display: flex;
  flex-direction: column;
  align-items: center;

  user-select: none;
}

.sat-label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.85);
}

/* 🌍 CENTER - WICHTIGER FIX */
.center {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: clamp(30px, 8vh, 90px);
}

/* 🌍 PLANET */
.planet {
  position: relative;
  width: clamp(200px, 65vw, 260px);
  height: clamp(200px, 65vw, 260px);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  background: radial-gradient(
    circle at 30% 30%,
    #78ffc8 0%,
    #2aa87a 35%,
    #046c3c 70%,
    #012015 100%
  );

  animation: float 6s ease-in-out infinite;
  overflow: visible;
}

/* 🔥 AURA */
.flame-aura {
  position: absolute;
  inset: -20%;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;

  background:
    radial-gradient(circle at 30% 20%, rgba(120, 255, 200, 0.35), transparent 45%),
    radial-gradient(circle at 70% 30%, rgba(0, 255, 160, 0.28), transparent 50%),
    radial-gradient(circle at 40% 80%, rgba(0, 220, 140, 0.22), transparent 55%),
    radial-gradient(circle at 80% 70%, rgba(120, 255, 200, 0.18), transparent 60%),
    radial-gradient(circle at 20% 60%, rgba(0, 180, 120, 0.2), transparent 55%);

  filter: blur(16px) contrast(1.3);
  opacity: 0.85;
  mix-blend-mode: screen;
}

/* CRATERS */
.craters {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.crater {
  position: absolute;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
}

.c1 {
  width: 12%;
  height: 12%;
  top: 15%;
  left: 25%;
}
.c2 {
  width: 8%;
  height: 8%;
  top: 55%;
  left: 65%;
}
.c3 {
  width: 10%;
  height: 10%;
  top: 35%;
  left: 55%;
}
.c4 {
  width: 6%;
  height: 6%;
  top: 20%;
  left: 60%;
}
.c5 {
  width: 7%;
  height: 7%;
  top: 70%;
  left: 30%;
}
.c6 {
  width: 5%;
  height: 5%;
  top: 45%;
  left: 20%;
}
.c7 {
  width: 9%;
  height: 9%;
  top: 25%;
  left: 40%;
}
.c8 {
  width: 4.5%;
  height: 4.5%;
  top: 60%;
  left: 50%;
}
.c9 {
  width: 6.5%;
  height: 6.5%;
  top: 80%;
  left: 60%;
}
/* TEXT */
.text-layer {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 5;
}
.metal {
  font-family: 'Metal Mania', cursive;
  color: white;

  font-size: clamp(2rem, 6vw, 5rem);
  text-align: center;

  text-shadow:
    0.25vw 0.25vw 0 #046c3c,
    0.5vw 0.5vw 0 #0a7f4a;

  white-space: nowrap;
}

/* 📱 MOBILE */
@media (max-width: 600px) {
  .metal {
    white-space: normal;
    font-size: 4.2rem;
    line-height: 1.05;

    text-shadow:
      4px 4px 0 #046c3c,
      8px 8px 0 #0a7f4a;
  }

  .mobile-break {
    display: inline;
  }
}

/* Desktop break verstecken */
@media (min-width: 601px) {
  .mobile-break {
    display: none;
  }
}

/* FLOAT */
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2vh);
  }
}
</style>
