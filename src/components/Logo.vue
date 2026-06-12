<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const warping = ref(false)

const goHome = () => {
  warping.value = true

  setTimeout(() => {
    router.push('/')
  }, 200)
}

const goLogin = () => {
  router.push('/login')
}
</script>

<template>
  <div class="scene">
    <!-- 🛰️ SATELLITE LOGIN -->
    <div class="satellite" @click.stop="goLogin">
      🛰️
      <span class="sat-label">LOGIN</span>
    </div>

    <!-- 🌍 PLANET -->
    <div class="planet" @click="goHome" :class="{ warp: warping }">
      <div class="flame-aura"></div>

      <div class="crater c1"></div>
      <div class="crater c2"></div>
      <div class="crater c3"></div>
      <div class="crater c4"></div>
      <div class="crater c5"></div>
      <div class="crater c6"></div>
      <div class="crater c7"></div>
      <div class="crater c8"></div>
      <div class="crater c9"></div>

      <GlitchedElement>
        <p class="metal">Camp MC Hammergeil</p>
      </GlitchedElement>
    </div>
  </div>
</template>

<style scoped>
.scene {
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 5vh;
  padding-bottom: 3vh;
  position: relative;
}

/* 🌍 PLANET */
.planet {
  cursor: pointer;

  width: 60vw;
  max-width: 220px;
  height: 60vw;
  max-height: 220px;

  border-radius: 50%;
  position: relative;

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
}

/* 🔥 FLAME AURA */
.flame-aura {
  position: absolute;
  inset: -22%;
  border-radius: 50%;
  pointer-events: none;
  z-index: -1;

  background:
    radial-gradient(circle at 30% 20%, rgba(120, 255, 200, 0.35), transparent 45%),
    radial-gradient(circle at 70% 30%, rgba(0, 255, 160, 0.28), transparent 50%),
    radial-gradient(circle at 40% 80%, rgba(0, 220, 140, 0.22), transparent 55%),
    radial-gradient(circle at 80% 70%, rgba(120, 255, 200, 0.18), transparent 60%),
    radial-gradient(circle at 20% 60%, rgba(0, 180, 120, 0.2), transparent 55%);

  filter: blur(16px) contrast(1.3);
  opacity: 0.85;
  mix-blend-mode: screen;

  animation:
    flameWobble 2s infinite ease-in-out,
    flameFlicker 5s infinite ease-in-out;
}

/* TEXT */
.metal {
  font-family: 'Metal Mania', cursive;
  color: white;

  font-size: clamp(1.2rem, 6vw, 4.5rem);
  white-space: nowrap;
  text-align: center;

  text-shadow:
    0.2vw 0.2vw 0 #046c3c,
    0.4vw 0.4vw 0 #0a7f4a;
}

/* CRATERS */
.crater {
  position: absolute;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  box-shadow:
    inset -0.3vw -0.3vw 0.6vw rgba(0, 0, 0, 0.35),
    inset 0.2vw 0.2vw 0.4vw rgba(255, 255, 255, 0.08);
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

/* 🛰️ SATELLITE LOGIN */
.satellite {
  position: absolute;

  top: 0%;
  right: 0%;

  font-size: 1.8rem;

  cursor: pointer;

  display: flex;
  flex-direction: column;
  align-items: center;

  user-select: none;

  z-index: 20;
}

/* glow */
.satellite::before {
  content: '';
  position: absolute;
  width: 60px;
  height: 60px;

  background: radial-gradient(circle, rgba(0, 255, 160, 0.25), transparent 60%);
  border-radius: 50%;

  z-index: -1;

  transform: translate(-10px, -10px);
}

/* label */
.sat-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.8);

  margin-top: 4px;

  text-shadow: 0 0 6px rgba(0, 255, 160, 0.5);
}

/* hover */
.satellite:hover {
  transform: scale(1.15);
  filter: drop-shadow(0 0 8px rgba(0, 255, 160, 0.6));
}

/* ANIMATIONS */
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2vh);
  }
}

@keyframes flameWobble {
  0% {
    transform: scale(0.98) rotate(0deg);
  }
  50% {
    transform: scale(1.05) rotate(-0.6deg);
  }
  100% {
    transform: scale(0.99) rotate(0deg);
  }
}

@keyframes flameFlicker {
  0%,
  100% {
    opacity: 0.6;
    filter: blur(16px);
  }
  50% {
    opacity: 0.95;
    filter: blur(18px);
  }
}
</style>
