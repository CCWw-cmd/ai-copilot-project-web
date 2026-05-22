import { defineConfig, presetUno, presetIcons } from 'unocss'

export default defineConfig({
  presets: [presetUno(),presetIcons({
      warn: true,
      prefix: ['i-'],
      extraProperties: {
        display: 'inline-block',
      },
    })],
  theme: {
    colors: {
      nebula: {
        50: '#f5efff',
        100: '#e8dbff',
        200: '#cfb8ff',
        300: '#b28cff',
        400: '#9b63ff',
        500: '#8748ff',
        600: '#7535f5',
        700: '#6227d8',
        800: '#4e22aa',
        900: '#30125f',
      },
    },
    boxShadow: {
      glow: '0 0 0 1px rgba(167, 139, 250, 0.12), 0 16px 45px rgba(91, 33, 182, 0.35)',
      soft: '0 10px 30px rgba(15, 23, 42, 0.28)',
    },
  },
  shortcuts: {
    'panel-sci':
      'rounded-3xl border border-white/10 bg-white/6 backdrop-blur-xl shadow-glow',
    'btn-primary':
      'inline-flex items-center justify-center rounded-full border border-nebula-300/40 bg-gradient-to-r from-nebula-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition duration-200 hover:scale-[1.02] hover:from-nebula-400 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-65',
    'btn-secondary':
      'inline-flex items-center justify-center rounded-full border border-white/14 bg-white/6 px-5 py-2.5 text-sm font-semibold text-white/88 transition duration-200 hover:border-nebula-300/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-65',
    'input-sci':
      'w-full rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-nebula-300/60 focus:bg-white/8 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.18)]',
  },
})
