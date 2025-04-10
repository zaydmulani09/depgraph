function stripComment(line: string): string {
  let inString = false
  let stringChar = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === '\\') { i++; continue }
      if (ch === stringChar) inString = false
    } else {
      if (ch === '"' || ch === "'") { inString = true; stringChar = ch }
      else if (ch === '#') return line.slice(0, i)
    }
  }
  return line
}

function splitOnComma(content: string): string[] {
  const parts: string[] = []
  let depth = 0
  let inString = false
  let stringChar = ''
  let start = 0

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inString) {
      if (ch === '\\') { i++; continue }
      if (ch === stringChar) inString = false
    } else {
      if (ch === '"' || ch === "'") { inString = true; stringChar = ch }
      else if (ch === '[' || ch === '{') depth++
      else if (ch === ']' || ch === '}') depth--
      else if (ch === ',' && depth === 0) {
        parts.push(content.slice(start, i))
        start = i + 1
      }
    }
  }
  parts.push(content.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

function parseInlineArray(content: string): unknown[] {
  const inner = content.trim()
  if (!inner) return []
  return splitOnComma(inner).map(parseValue)
}

function parseInlineTable(content: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  const pairs = splitOnComma(content)
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx === -1) continue
    const k = pair.slice(0, eqIdx).trim()
    const v = pair.slice(eqIdx + 1).trim()
    if (k) obj[k] = parseValue(v)
  }
  return obj
}

function parseValue(val: string): unknown {
  const v = val.trim()
  if (!v) return v

  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^-?\d+$/.test(v)) return parseInt(v, 10)
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v)
  if (v.startsWith('{') && v.endsWith('}')) return parseInlineTable(v.slice(1, -1))
  if (v.startsWith('[') && v.endsWith(']')) return parseInlineArray(v.slice(1, -1))

  return v
}

function setNestedKey(
  root: Record<string, unknown>,
  sectionPath: string[],
  key: string,
  value: unknown
): void {
  let obj = root
  for (const part of sectionPath) {
    if (!(part in obj) || typeof obj[part] !== 'object' || obj[part] === null || Array.isArray(obj[part])) {
      obj[part] = {}
    }
    obj = obj[part] as Record<string, unknown>
  }
  obj[key] = value
}

export function parseToml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  let currentPath: string[] = []
  let currentObj: Record<string, unknown> = result

  const setSection = (path: string[]) => {
    currentPath = path
    let obj = result
    for (const part of path) {
      if (!(part in obj) || typeof obj[part] !== 'object' || obj[part] === null || Array.isArray(obj[part])) {
        obj[part] = {}
      }
      obj = obj[part] as Record<string, unknown>
    }
    currentObj = obj
  }

  for (const rawLine of content.split('\n')) {
    const line = stripComment(rawLine).trim()
    if (!line) continue

    // Array of tables [[section]]
    const arrayMatch = line.match(/^\[\[([^\]]+)\]\]$/)
    if (arrayMatch) {
      const sectionName = arrayMatch[1].trim()
      if (!result[sectionName] || !Array.isArray(result[sectionName])) {
        result[sectionName] = []
      }
      const newObj: Record<string, unknown> = {}
      ;(result[sectionName] as Record<string, unknown>[]).push(newObj)
      currentPath = [sectionName]
      currentObj = newObj
      continue
    }

    // Section header [section] or [a.b.c]
    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      const parts = sectionMatch[1].trim().split('.').map((p) => p.trim())
      setSection(parts)
      continue
    }

    // Key = value
    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue

    const key = line.slice(0, eqIdx).trim()
    const valueStr = line.slice(eqIdx + 1).trim()
    if (!key) continue

    try {
      currentObj[key] = parseValue(valueStr)
    } catch {
      // skip unparseable lines
    }
  }

  return result
}

export function parseCargoToml(content: string): {
  package?: { name?: string; version?: string; edition?: string }
  dependencies?: Record<string, string | { version: string; optional?: boolean; features?: string[]; git?: string }>
  devDependencies?: Record<string, string | { version: string }>
  buildDependencies?: Record<string, string | { version: string }>
  features?: Record<string, string[]>
} {
  const raw = parseToml(content)
  return {
    package: raw['package'] as { name?: string; version?: string; edition?: string } | undefined,
    dependencies: raw['dependencies'] as Record<string, string | { version: string; optional?: boolean; features?: string[]; git?: string }> | undefined,
    devDependencies: raw['dev-dependencies'] as Record<string, string | { version: string }> | undefined,
    buildDependencies: raw['build-dependencies'] as Record<string, string | { version: string }> | undefined,
    features: raw['features'] as Record<string, string[]> | undefined,
  }
}
