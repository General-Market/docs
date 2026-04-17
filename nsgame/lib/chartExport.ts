const WATERMARK_TEXT = 'indexvision.com'
const WATERMARK_FONT = '14px Inter, system-ui, sans-serif'
const WATERMARK_COLOR = 'rgba(255, 255, 255, 0.5)'
const WATERMARK_PADDING = 16

export async function exportChartAsImage(
  chartElement: HTMLElement
): Promise<Blob | null> {
  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(chartElement, {
      backgroundColor: '#09090b', // matches bg-card / zinc-950
      scale: 2,
      logging: false,
      useCORS: true,
    })

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Stamp watermark
    ctx.font = WATERMARK_FONT
    ctx.fillStyle = WATERMARK_COLOR
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(
      WATERMARK_TEXT,
      canvas.width - WATERMARK_PADDING,
      canvas.height - WATERMARK_PADDING
    )

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
  } catch {
    return null
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  try {
    a.click()
  } finally {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
