declare module 'vue-powerglitch' {
  import type { App } from 'vue'

  const plugin: {
    install(app: App): void
  }

  export default plugin

  export const GlitchedElement: any
  export const vGlitch: any
}
