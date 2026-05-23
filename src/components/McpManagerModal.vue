<template>
  <n-modal
    :show="show"
    preset="card"
    style="width: min(1100px, 92vw)"
    class="!border-white/10 !bg-[#120f1b]"
    title="MCP 管理"
    @update:show="emit('update:show', $event)"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-white/55">
          新增、编辑或删除 MCP 配置后，后端会自动重新拉取并注册工具。
        </div>
        <div class="flex items-center gap-2">
          <n-button class="!rounded-xl" @click="isJsonImportOpen = true">
            批量导入
          </n-button>
          <n-button type="primary" class="!rounded-xl" @click="openCreate">
            新增 MCP
          </n-button>
        </div>
      </div>

      <n-spin :show="loading">
        <div v-if="items.length === 0" class="rounded-2xl border border-dashed border-white/10 bg-white/3 py-12">
          <n-empty description="暂无 MCP 配置" />
        </div>

        <div v-else class="grid gap-3 md:grid-cols-2">
          <div
            v-for="item in items"
            :key="item.id"
            class="rounded-2xl border border-white/8 bg-white/4 p-4 transition-colors hover:border-white/14"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <div class="truncate text-base font-semibold text-white">
                    {{ item.displayName || item.name }}
                  </div>
                  <n-tag
                    round
                    size="small"
                    :bordered="false"
                    :class="item.isActive ? '!bg-emerald-500/14 !text-emerald-200' : '!bg-rose-500/14 !text-rose-200'"
                  >
                    {{ item.isActive ? '启用' : '停用' }}
                  </n-tag>
                </div>
                <div class="mt-1 text-xs text-white/40">
                  标识：{{ item.name }}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <n-switch
                  size="small"
                  :value="item.isActive"
                  :loading="togglingItemIds.includes(item.id)"
                  @update:value="toggleItemActive(item, $event)"
                />
                <n-button quaternary size="small" class="!rounded-xl" @click="openEdit(item)">
                  编辑
                </n-button>
                <n-popconfirm @positive-click="removeItem(item)">
                  <template #trigger>
                    <n-button quaternary size="small" class="!rounded-xl !text-rose-200">
                      删除
                    </n-button>
                  </template>
                  确认删除该 MCP 配置吗？
                </n-popconfirm>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2 text-xs">
              <n-tag :bordered="false" round class="!bg-cyan-500/10 !text-cyan-100">
                {{ item.transport }}
              </n-tag>
              <n-tag :bordered="false" round class="!bg-white/8 !text-white/60">
                {{ item.command ? 'stdio' : '远程' }}
              </n-tag>
            </div>

            <div
              v-if="item.description"
              class="mt-4 max-h-24 overflow-y-auto pr-1 text-sm leading-6 text-white/68"
            >
              {{ item.description }}
            </div>
          </div>
        </div>
      </n-spin>
    </div>
  </n-modal>

  <n-modal
    :show="isJsonImportOpen"
    preset="card"
    style="width: min(860px, 92vw)"
    class="!border-white/10 !bg-[#171321]"
    title="批量导入 MCP"
    @update:show="handleJsonImportShowChange"
  >
    <div class="space-y-4">
      <div class="text-sm leading-6 text-white/60">
        支持直接粘贴 MCP 配置的 JSON 内容。可粘贴完整对象，也可只粘贴单条配置片段。
      </div>

      <n-input
        v-model:value="jsonImportText"
        type="textarea"
        :autosize="{ minRows: 10, maxRows: 20 }"
        placeholder='例如：{ "market-cmapi00048445": { "type": "streamableHttp", "baseUrl": "https://...", "headers": { "Authorization": "Bearer ${DASHSCOPE_API_KEY}" } } }'
      />

      <div class="flex justify-end gap-3">
        <n-button quaternary class="!rounded-xl" @click="closeJsonImport">
          取消
        </n-button>
        <n-button type="primary" class="!rounded-xl" :loading="importingJson" @click="submitJsonImport">
          导入并保存
        </n-button>
      </div>
    </div>
  </n-modal>

  <n-modal
    :show="isEditorOpen"
    preset="card"
    style="width: min(760px, 92vw)"
    class="!border-white/10 !bg-[#171321]"
    :title="editingId ? '编辑 MCP' : '新增 MCP'"
    @update:show="handleEditorShowChange"
  >
    <n-form label-placement="top" :model="form">
      <div class="grid gap-4 md:grid-cols-2">
        <n-form-item label="名称">
          <n-input v-model:value="form.name" placeholder="例如：amap-maps" />
        </n-form-item>
        <n-form-item label="显示名称">
          <n-input v-model:value="form.displayName" placeholder="例如：高德地图" />
        </n-form-item>
      </div>

      <n-form-item label="描述">
        <n-input
          v-model:value="form.description"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          placeholder="描述这个 MCP 的用途"
        />
      </n-form-item>

      <div class="grid gap-4 md:grid-cols-2">
        <n-form-item label="传输方式">
          <n-select v-model:value="form.transport" :options="transportOptions" />
        </n-form-item>
        <n-form-item label="启用状态">
          <div class="flex h-40px items-center">
            <n-switch v-model:value="form.isActive" />
          </div>
        </n-form-item>
      </div>

      <div v-if="isStdioTransport" class="grid gap-4 md:grid-cols-2">
        <n-form-item label="Command">
          <n-input v-model:value="form.command" placeholder="例如：npx" />
        </n-form-item>
        <n-form-item label="Args(JSON 数组)">
          <n-input
            v-model:value="form.argsText"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 6 }"
            placeholder='例如：["-y", "@modelcontextprotocol/server-filesystem", "D:/data"]'
          />
        </n-form-item>
      </div>

      <template v-else>
        <n-form-item label="URL">
          <n-input v-model:value="form.url" placeholder="例如：https://example.com/mcp" />
        </n-form-item>
        <n-form-item label="Headers(JSON 对象)">
          <n-input
            v-model:value="form.headersText"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder='例如：{"Authorization":"Bearer ${DASHSCOPE_API_KEY}"}'
          />
        </n-form-item>
      </template>

      <div class="mt-4 flex justify-end gap-3">
        <n-button quaternary class="!rounded-xl" @click="closeEditor">
          取消
        </n-button>
        <n-button type="primary" class="!rounded-xl" :loading="saving" @click="submitForm">
          保存
        </n-button>
      </div>
    </n-form>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { http } from '../lib/http'

type McpItem = {
  id: number
  name: string
  displayName: string | null
  description: string | null
  transport: string
  isActive: boolean
  command: string | null
  args: string[] | null
  url: string | null
  headers: Record<string, string> | null
  createdAt: string
  updatedAt: string
}

type McpFormState = {
  name: string
  displayName: string
  description: string
  transport: string
  isActive: boolean
  command: string
  argsText: string
  url: string
  headersText: string
}

type RawJsonMcpConfig = {
  type?: string
  transport?: string
  description?: string
  isActive?: boolean
  name?: string
  displayName?: string
  baseUrl?: string
  url?: string
  command?: string
  args?: unknown
  headers?: Record<string, unknown> | null
}

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const items = ref<McpItem[]>([])
const isEditorOpen = ref(false)
const isJsonImportOpen = ref(false)
const editingId = ref<number | null>(null)
const jsonImportText = ref('')
const importingJson = ref(false)
const togglingItemIds = ref<number[]>([])

const transportOptions = [
  { label: 'streamableHttp', value: 'streamableHttp' },
  { label: 'http', value: 'http' },
  { label: 'streamableSSE', value: 'streamableSSE' },
  { label: 'sse', value: 'sse' },
  { label: 'stdio', value: 'stdio' }
]

const form = reactive<McpFormState>(createEmptyForm())

const isStdioTransport = computed(() => form.transport === 'stdio')

watch(
  () => props.show,
  (show) => {
    if (show) {
      void loadMcps()
      return
    }

    isEditorOpen.value = false
    isJsonImportOpen.value = false
    jsonImportText.value = ''
    resetForm()
  }
)

function createEmptyForm(): McpFormState {
  return {
    name: '',
    displayName: '',
    description: '',
    transport: 'streamableHttp',
    isActive: true,
    command: '',
    argsText: '',
    url: '',
    headersText: ''
  }
}

function resetForm() {
  Object.assign(form, createEmptyForm())
  editingId.value = null
}

function openCreate() {
  resetForm()
  isEditorOpen.value = true
}

function openEdit(item: McpItem) {
  editingId.value = item.id
  Object.assign(form, {
    name: item.name,
    displayName: item.displayName || '',
    description: item.description || '',
    transport: item.transport,
    isActive: item.isActive,
    command: item.command || '',
    argsText: item.args ? JSON.stringify(item.args, null, 2) : '',
    url: item.url || '',
    headersText: item.headers ? JSON.stringify(item.headers, null, 2) : ''
  })
  isEditorOpen.value = true
}

function closeEditor() {
  isEditorOpen.value = false
}

function closeJsonImport() {
  isJsonImportOpen.value = false
  jsonImportText.value = ''
}

function handleEditorShowChange(value: boolean) {
  isEditorOpen.value = value
  if (!value) {
    resetForm()
  }
}

function handleJsonImportShowChange(value: boolean) {
  isJsonImportOpen.value = value
  if (!value) {
    jsonImportText.value = ''
  }
}

async function loadMcps() {
  loading.value = true
  try {
    const { data } = await http.get<McpItem[]>('/mcps')
    items.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('加载 MCP 配置失败', error)
    message.error('加载 MCP 配置失败')
  } finally {
    loading.value = false
  }
}

function parseJsonArray(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return null

  const parsed = JSON.parse(trimmed)
  if (!Array.isArray(parsed)) {
    throw new Error('Args 必须是 JSON 数组')
  }

  return parsed.map((item) => String(item))
}

function parseJsonObject(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return null

  const parsed = JSON.parse(trimmed)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers 必须是 JSON 对象')
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, String(value)])
  ) as Record<string, string>
}

function normalizeJsonText(rawText: string) {
  let text = rawText.trim()
  if (!text) {
    throw new Error('请输入 JSON 内容')
  }

  text = text.replace(/```json|```/gi, '').trim()

  if (!text.startsWith('{')) {
    text = `{${text}}`
  }

  return text
}

function sanitizeString(value?: string | null) {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/`/g, '').trim()
  return normalized || null
}

function buildPayloadFromJsonEntry(entryName: string, rawConfig: RawJsonMcpConfig) {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    throw new Error(`MCP ${entryName} 的配置格式不正确`)
  }

  const transport = sanitizeString(rawConfig.transport || rawConfig.type)
  const command = sanitizeString(rawConfig.command)
  const url = sanitizeString(rawConfig.url || rawConfig.baseUrl)
  const args = Array.isArray(rawConfig.args)
    ? rawConfig.args.map((item) => String(item))
    : null
  const headers = rawConfig.headers && typeof rawConfig.headers === 'object' && !Array.isArray(rawConfig.headers)
    ? Object.fromEntries(
        Object.entries(rawConfig.headers).map(([key, value]) => [key, String(value).replace(/`/g, '').trim()])
      )
    : null

  return {
    name: sanitizeString(entryName),
    displayName: sanitizeString(rawConfig.displayName || rawConfig.name),
    description: sanitizeString(rawConfig.description),
    transport: transport || 'streamableHttp',
    isActive: rawConfig.isActive !== false,
    command,
    args,
    url,
    headers
  }
}

function parseJsonImportPayload(rawText: string) {
  const normalizedText = normalizeJsonText(rawText)
  const parsed = JSON.parse(normalizedText) as Record<string, RawJsonMcpConfig>

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON 顶层必须是对象')
  }

  const entries = Object.entries(parsed)
  if (entries.length === 0) {
    throw new Error('没有可导入的 MCP 配置')
  }

  return entries.map(([entryName, rawConfig]) => {
    const payload = buildPayloadFromJsonEntry(entryName, rawConfig)
    if (!payload.name) {
      throw new Error('MCP 名称不能为空')
    }
    return payload
  })
}

async function submitForm() {
  try {
    saving.value = true
    const payload = {
      name: form.name.trim(),
      displayName: form.displayName.trim() || null,
      description: form.description.trim() || null,
      transport: form.transport,
      isActive: form.isActive,
      command: isStdioTransport.value ? form.command.trim() || null : null,
      args: isStdioTransport.value ? parseJsonArray(form.argsText) : null,
      url: isStdioTransport.value ? null : form.url.trim() || null,
      headers: isStdioTransport.value ? null : parseJsonObject(form.headersText)
    }

    if (editingId.value) {
      await http.patch(`/mcps/${editingId.value}`, payload)
      message.success('MCP 已更新')
    } else {
      await http.post('/mcps', payload)
      message.success('MCP 已创建')
    }

    closeEditor()
    resetForm()
    await loadMcps()
  } catch (error: any) {
    console.error('保存 MCP 失败', error)
    const detail = error?.response?.data?.message
    message.error(Array.isArray(detail) ? detail.join('，') : detail || error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function submitJsonImport() {
  try {
    importingJson.value = true
    const payloads = parseJsonImportPayload(jsonImportText.value)

    for (const payload of payloads) {
      const existing = items.value.find((item) => item.name === payload.name)
      if (existing) {
        await http.patch(`/mcps/${existing.id}`, payload)
      } else {
        await http.post('/mcps', payload)
      }
    }

    message.success(`已导入 ${payloads.length} 条 MCP 配置`)
    closeJsonImport()
    await loadMcps()
  } catch (error: any) {
    console.error('JSON 导入 MCP 失败', error)
    const detail = error?.response?.data?.message
    message.error(Array.isArray(detail) ? detail.join('，') : detail || error?.message || 'JSON 导入失败')
  } finally {
    importingJson.value = false
  }
}

async function removeItem(item: McpItem) {
  try {
    await http.delete(`/mcps/${item.id}`)
    message.success(`已删除 ${item.displayName || item.name}`)
    await loadMcps()
  } catch (error: any) {
    console.error('删除 MCP 失败', error)
    const detail = error?.response?.data?.message
    message.error(Array.isArray(detail) ? detail.join('，') : detail || '删除失败')
  }
}

async function toggleItemActive(item: McpItem, value: boolean) {
  if (item.isActive === value || togglingItemIds.value.includes(item.id)) {
    return
  }

  togglingItemIds.value = [...togglingItemIds.value, item.id]
  try {
    const { data } = await http.patch<McpItem>(`/mcps/${item.id}`, { isActive: value })
    items.value = items.value.map((current) => (current.id === item.id ? data : current))
    message.success(`${item.displayName || item.name} 已${value ? '启用' : '停用'}`)
  } catch (error: any) {
    console.error('切换 MCP 启用状态失败', error)
    const detail = error?.response?.data?.message
    message.error(Array.isArray(detail) ? detail.join('，') : detail || '切换状态失败')
  } finally {
    togglingItemIds.value = togglingItemIds.value.filter((id) => id !== item.id)
  }
}
</script>
