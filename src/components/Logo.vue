<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const warping = ref(false)

const goHome = () => {
  const el = document.querySelector('.planet')
  if (!el) return

  el.classList.add('warp')

  setTimeout(() => {
    router.push('/')
  }, 200)
}
</script>

<template>
  <div class="scene">
    <div class="planet" @click="goHome" :class="{ warp: warping }">
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
}

/* 🌍 PLANET */
.planet {
  cursor: pointer;

  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    filter 0.25s ease;

  will-change: transform;

  width: 60vw;
  max-width: 220px;
  height: 60vw;
  max-height: 220px;

  border-radius: 50%;

  display: flex;
  justify-content: center;
  align-items: center;

  position: relative;

  background: radial-gradient(
    circle at 30% 30%,
    #78ffc8 0%,
    #2aa87a 35%,
    #046c3c 70%,
    #012015 100%
  );

  box-shadow:
    0 0 4vw rgba(120, 255, 200, 0.4),
    0 0 8vw rgba(0, 255, 180, 0.2);

  animation: float 6s ease-in-out infinite;
}

/* 👆 Hover Effekt */
.planet:hover {
  transform: scale(1.08);
  box-shadow:
    0 0 6vw rgba(120, 255, 200, 0.6),
    0 0 12vw rgba(0, 255, 180, 0.4);
  filter: brightness(1.1);
}

/* 👇 Click Feedback */
.planet:active {
  transform: scale(0.97);
  filter: brightness(0.9);
}

.planet.warp {
  animation: warpOut 0.6s ease forwards;
}

/* 🎸 TEXT */
.metal {
  font-family: 'Metal Mania', cursive;
  color: white;

  font-size: clamp(1.2rem, 6vw, 4.5rem);
  white-space: nowrap;
  text-align: center;
  letter-spacing: 0.3vw;
  text-transform: uppercase;

  text-shadow:
    0.2vw 0.2vw 0 #046c3c,
    0.4vw 0.4vw 0 #0a7f4a,
    0.6vw 0.6vw 0 #78ffc8;
}

.crater {
  position: absolute;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
  box-shadow:
    inset -0.3vw -0.3vw 0.6vw rgba(0, 0, 0, 0.35),
    inset 0.2vw 0.2vw 0.4vw rgba(255, 255, 255, 0.08);
}

/* Krater skalierbar gemacht */
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
