import { ref } from 'vue'
import { createDiscreteApi, darkTheme } from 'naive-ui'

const { message } = createDiscreteApi(['message'], {
  configProviderProps: {
    theme: darkTheme
  }
})

function buildSerializableSvg(svg: SVGSVGElement, width: number, height: number) {
  const clonedSvg = svg.cloneNode(true) as SVGSVGElement
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clonedSvg.setAttribute('width', `${width}`)
  clonedSvg.setAttribute('height', `${height}`)

  if (!clonedSvg.getAttribute('viewBox')) {
    clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  }

  const styleTag = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  styleTag.textContent = `
    .markmap { background: #ffffff; }
    .markmap-node circle { fill: #ffffff; stroke: #1f2937; stroke-width: 1.5px; }
    .markmap-node text { fill: #1f2937; font-size: 14px; font-weight: 500; }
    .markmap-link { fill: none; stroke: #9ca3af; stroke-width: 1.5px; }
  `
  clonedSvg.insertBefore(styleTag, clonedSvg.firstChild)

  return new XMLSerializer().serializeToString(clonedSvg)
}

export function usePdfExport() {
  const isExporting = ref(false)

  const exportToPdf = async (exportContentRef: HTMLElement | null, filename?: string) => {
    if (!exportContentRef) return
    
    // @ts-ignore
    if (typeof window.html2pdf === 'undefined') {
      message.error('PDF 导出组件尚未加载完成，请稍后再试')
      return
    }
    
    isExporting.value = true
    let container: HTMLDivElement | null = null
    
    try {
      const element = exportContentRef
      
      // 1. 捕捉图表 (Canvas)
      const originalCharts = element.querySelectorAll('.chart-instance canvas')
      const chartImages = Array.from(originalCharts).map(canvas => {
        try {
          return (canvas as HTMLCanvasElement).toDataURL('image/png')
        } catch (e) {
          console.warn('Canvas toDataURL failed (possibly tainted):', e)
          return ''
        }
      })
      
      // 2. 捕捉脑图 (SVG 转 图片)
      const originalMindmaps = element.querySelectorAll('.mindmap-container svg')
      const mindmapImages = await Promise.all(Array.from(originalMindmaps).map(async (svg) => {
        return new Promise<string>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('SVG conversion timed out')
            resolve('')
          }, 3000)

          try {
            const svgElement = svg as SVGSVGElement
            const svgRect = svgElement.getBoundingClientRect()
            const width = Math.max(Math.round(svgRect.width || svgElement.clientWidth || 800), 1)
            const height = Math.max(Math.round(svgRect.height || svgElement.clientHeight || 600), 1)
            
            const svgData = buildSerializableSvg(svgElement, width, height)
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            const img = new Image()
            
            img.crossOrigin = 'anonymous'
            
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
            const url = URL.createObjectURL(svgBlob)
            
            img.onload = () => {
              clearTimeout(timeout)
              try {
                canvas.width = width * 2
                canvas.height = height * 2
                ctx?.scale(2, 2)
                ctx?.fillRect(0, 0, width, height)
                ctx?.drawImage(img, 0, 0, width, height)
                const dataUrl = canvas.toDataURL('image/png')
                URL.revokeObjectURL(url)
                resolve(dataUrl)
              } catch (e) {
                console.warn('SVG canvas export failed:', e)
                URL.revokeObjectURL(url)
                resolve('')
              }
            }
            img.onerror = () => {
              clearTimeout(timeout)
              URL.revokeObjectURL(url)
              resolve('')
            }
            img.src = url
          } catch (e) {
            clearTimeout(timeout)
            console.warn('SVG processing failed:', e)
            resolve('')
          }
        })
      }))
      
      // 3. 克隆并替换内容
      const clone = element.cloneNode(true) as HTMLElement
      
      const clonedChartContainers = clone.querySelectorAll('.chart-instance')
      clonedChartContainers.forEach((container, i) => {
        if (chartImages[i]) {
          const img = document.createElement('img')
          img.src = chartImages[i]
          img.style.width = '100%'
          img.style.height = 'auto'
          img.style.display = 'block'
          img.style.borderRadius = '8px'
          container.innerHTML = ''
          container.appendChild(img)
          ;(container as HTMLElement).style.height = 'auto'
          ;(container as HTMLElement).style.minHeight = '0'
        }
      })

      const clonedMindmapContainers = clone.querySelectorAll('.mindmap-container')
      clonedMindmapContainers.forEach((container, i) => {
        if (mindmapImages[i]) {
          const img = document.createElement('img')
          img.src = mindmapImages[i]
          img.style.width = '100%'
          img.style.height = 'auto'
          img.style.display = 'block'
          container.innerHTML = ''
          container.appendChild(img)
          ;(container as HTMLElement).style.height = 'auto'
        }
      })
      
      // 过滤掉克隆体中不需要的文本元素
      const paragraphs = clone.querySelectorAll('p, div')
      paragraphs.forEach(p => {
        const text = p.textContent?.trim() || ''
        if (/^(✅|分析完成|任务完成|🟣)/i.test(text)) {
          p.remove()
        }
      })

      // 4. 创建离屏容器
      container = document.createElement('div')
      container.style.position = 'absolute'
      container.style.left = '-9999px'
      container.style.top = '0'
      container.style.width = (element.offsetWidth || 800) + 'px'
      container.style.zIndex = '-1'
      
      clone.classList.add('pdf-export-mode')
      container.appendChild(clone)
      document.body.appendChild(container)

      const finalFilename = filename 
        ? (filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
        : `AI-Analysis-${new Date().getTime()}.pdf`

      const opt = {
        margin: [10, 10, 10, 10],
        filename: finalFilename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          letterRendering: true,
          allowTaint: true,
          scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }

      // @ts-ignore
      await window.html2pdf().set(opt).from(clone).save()
      message.success('导出成功')
    } catch (error) {
      console.error('PDF export error:', error)
      message.error('导出失败，请重试')
    } finally {
      if (container && container.parentNode) {
        document.body.removeChild(container)
      }
      isExporting.value = false
    }
  }

  return {
    isExporting,
    exportToPdf
  }
}
