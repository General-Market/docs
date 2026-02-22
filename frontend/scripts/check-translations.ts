import fs from 'fs'
import path from 'path'

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')
const LOCALES = ['en', 'ko', 'ja', 'zh']
const SOURCE_LOCALE = 'en'

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null) {
      return getKeys(value as Record<string, unknown>, fullKey)
    }
    return [fullKey]
  })
}

let hasErrors = false

const sourceDir = path.join(MESSAGES_DIR, SOURCE_LOCALE)
const namespaces = fs.readdirSync(sourceDir).filter(f => f.endsWith('.json'))

for (const ns of namespaces) {
  const sourceKeys = getKeys(JSON.parse(fs.readFileSync(path.join(sourceDir, ns), 'utf8')))

  for (const locale of LOCALES.filter(l => l !== SOURCE_LOCALE)) {
    const targetPath = path.join(MESSAGES_DIR, locale, ns)
    if (!fs.existsSync(targetPath)) {
      console.error(`MISSING: ${locale}/${ns}`)
      hasErrors = true
      continue
    }
    const targetKeys = getKeys(JSON.parse(fs.readFileSync(targetPath, 'utf8')))
    const missing = sourceKeys.filter(k => !targetKeys.includes(k))
    const extra = targetKeys.filter(k => !sourceKeys.includes(k))
    if (missing.length) {
      console.error(`${locale}/${ns}: ${missing.length} missing keys: ${missing.join(', ')}`)
      hasErrors = true
    }
    if (extra.length) {
      console.warn(`${locale}/${ns}: ${extra.length} extra keys: ${extra.join(', ')}`)
    }
  }
}

if (hasErrors) {
  console.error('\nTranslation check FAILED -- missing keys found.')
  process.exit(1)
} else {
  console.log('\nAll translations complete!')
}
