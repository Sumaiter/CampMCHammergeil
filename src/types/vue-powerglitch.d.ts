// Das Paket liefert eigene Typen, verweist in "exports" aber nicht darauf – daher hier deklariert.
declare module 'vue-powerglitch' {
  import type { App, Component, Directive } from 'vue'

  const plugin: {
    install(app: App): void
  }

  export default plugin

  export const GlitchedElement: Component
  export const vGlitch: Directive
}
