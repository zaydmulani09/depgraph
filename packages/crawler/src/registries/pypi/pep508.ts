import { normalizePypiName } from './client'

export interface Pep508Dependency {
  name: string
  extras: string[]
  versionSpec: string
  marker: string | null
  isOptional: boolean
  isDev: boolean
}

export function parsePep508(specifier: string): Pep508Dependency | null {
  const trimmed = specifier.trim()
  if (!trimmed) return null

  const semiIdx = trimmed.indexOf(';')
  const depPart = semiIdx === -1 ? trimmed : trimmed.slice(0, semiIdx).trim()
  const marker = semiIdx === -1 ? null : trimmed.slice(semiIdx + 1).trim() || null

  // Match name with optional extras: Name[extra1,extra2]version_spec
  const withExtras = depPart.match(/^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)\[([^\]]*)\](.*)$/)
  const withoutExtras = depPart.match(/^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)(.*)$/)

  let rawName: string
  let extras: string[]
  let versionSpec: string

  if (withExtras) {
    rawName = withExtras[1]
    extras = withExtras[2].split(',').map((e) => e.trim()).filter(Boolean)
    versionSpec = withExtras[3].trim()
  } else if (withoutExtras) {
    rawName = withoutExtras[1]
    extras = []
    versionSpec = withoutExtras[2].trim()
  } else {
    return null
  }

  if (!rawName) return null

  const name = normalizePypiName(rawName)
  const isDev = marker !== null && /extra\s*==/.test(marker)
  const isOptional =
    isDev ||
    (marker !== null && !/python_version/.test(marker) && !/sys_platform/.test(marker))

  return { name, extras, versionSpec, marker, isOptional, isDev }
}
