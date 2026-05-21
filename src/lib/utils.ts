import DOMPurify from 'dompurify'
import { marked } from 'marked'

/**
 * 将 Markdown 文本转换为安全的 HTML，并处理引用标签和特定样式
 */
export function renderMarkdown(markdown: string): string {
  let content = markdown

  // 将 [cite: index] 转换为可点击的 UI
  content = content.replace(/\[cite:\s*(\d+)\]/g, (match, index) => {
    return `<span class="citation-tag" data-index="${index}">[${index}]</span>`
  })

  // 处理最后的“引用来源:”列表，使其更有设计感
  content = content.replace(/引用来源:\s*([\s\S]*)$/i, (match, list) => {
    const items = list.trim().split('\n').filter((l) => l.trim().startsWith('-'))
    if (items.length === 0) return match

    const cards = items
      .map((item) => {
        const citeMatch = item.match(
          /\[cite:\s*(\d+)\]\s*(.*)\s*\(匹配度:\s*([\d.]+),\s*页码:\s*(\d+)\)/
        )
        if (!citeMatch) return `<div class="citation-card-simple">${item}</div>`

        const [_, index, title, score, page] = citeMatch
        return `
         <div class="citation-card" 
              data-title="${title}" 
              data-page="${page}" 
              data-score="${score}">
           <div class="citation-card-index">${index}</div>
           <div class="citation-card-content">
             <div class="citation-card-title">${title}</div>
             <div class="citation-card-meta">
               <span class="citation-score">匹配度: ${score}</span>
               <span class="citation-page">页码: ${page}</span>
             </div>
           </div>
           <div class="citation-card-action">点击定位</div>
         </div>
       `
      })
      .join('')

    return `<div class="citations-container"><div class="citations-header">引用来源</div>${cards}</div>`
  })

  return DOMPurify.sanitize(marked.parse(content, { breaks: true }) as string)
}

/**
 * 序列化 Payload 数据
 */
export function serializePayload(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload
  }

  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

/**
 * 格式化错误信息
 */
export function formatError(error: unknown): string {
  // 注意：axios 相关检查可能需要外部依赖
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as any
    if (axiosError.response?.data) {
      return serializePayload(axiosError.response.data)
    }
    return axiosError.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

/**
 * 创建上传任务 ID
 */
export function createUploadTaskId(): string {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID()
  }

  return `rag-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
