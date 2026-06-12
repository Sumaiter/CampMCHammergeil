<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="scene">
    <div class="planet" @click="goHome">
      <div class="crater c1"></div>
      <div class="crater c2"></div>
      <div class="crater c3"></div>
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
