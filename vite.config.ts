import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from '@unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import { codeInspectorPlugin } from 'code-inspector-plugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': [
            'useDialog',
            'useMessage',
            'useNotification',
            'useLoadingBar'
          ]
        }
      ]
    }),
    Components({
      resolvers: [NaiveUiResolver()]
    }),
    codeInspectorPlugin({
      bundler: 'vite',
    }),
  ],
  server:{
    host: '0.0.0.0',
  }
})
