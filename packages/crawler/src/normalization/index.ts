import { NpmAdapter } from './adapters/npm-adapter'
import { PypiAdapter } from './adapters/pypi-adapter'
import { CargoAdapter } from './adapters/cargo-adapter'
import type { Ecosystem, EcosystemAdapter } from './adapter'

export const adapters = {
  npm: new NpmAdapter(),
  pypi: new PypiAdapter(),
  cargo: new CargoAdapter(),
} as const

export function getAdapter(ecosystem: Ecosystem): EcosystemAdapter {
  return adapters[ecosystem]
}

export * from './adapter'
export * from './version-normalizer'
export * from './range-normalizer'
export * from './identity-resolver'
export * from './chokepoint-detector'
