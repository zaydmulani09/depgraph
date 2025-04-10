export interface CargoConstraint {
  operator: '^' | '~' | '=' | '>=' | '>' | '<=' | '<' | '*'
  major: number | null
  minor: number | null
  patch: number | null
  raw: string
}

export interface CargoVersionReq {
  raw: string
  constraints: CargoConstraint[]
}

function parseSingleConstraint(part: string): CargoConstraint {
  const trimmed = part.trim()

  if (!trimmed || trimmed === '*') {
    return { operator: '*', major: null, minor: null, patch: null, raw: trimmed || '*' }
  }

  const opMatch = trimmed.match(/^(\^|~|>=|<=|>|<|=)?(.*)$/)
  if (!opMatch) {
    return { operator: '^', major: null, minor: null, patch: null, raw: trimmed }
  }

  const operator = (opMatch[1] || '^') as CargoConstraint['operator']
  const versionStr = opMatch[2].trim()

  if (!versionStr || versionStr === '*') {
    return { operator: '*', major: null, minor: null, patch: null, raw: trimmed }
  }

  const vparts = versionStr.split('.').map((s) => {
    if (s === '*') return null
    const n = parseInt(s, 10)
    return isNaN(n) ? null : n
  })

  return {
    operator,
    major: vparts[0] ?? null,
    minor: vparts[1] ?? null,
    patch: vparts[2] ?? null,
    raw: trimmed,
  }
}

export function parseCargoVersionReq(req: string): CargoVersionReq {
  const raw = req.trim()
  try {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length === 0) {
      return { raw, constraints: [{ operator: '^', major: null, minor: null, patch: null, raw }] }
    }
    const constraints = parts.map(parseSingleConstraint)
    return { raw, constraints }
  } catch {
    return { raw, constraints: [{ operator: '^', major: null, minor: null, patch: null, raw }] }
  }
}

export function cargoReqToString(req: CargoVersionReq): string {
  return req.constraints
    .map((c) => {
      if (c.operator === '*') return '*'
      const parts = [c.major, c.minor, c.patch].filter((v) => v !== null)
      const version = parts.length > 0 ? parts.join('.') : '*'
      return c.operator === '^' ? `^${version}` : `${c.operator}${version}`
    })
    .join(', ')
}
