import { useQuery } from '@tanstack/react-query'
import { fetchPackageSubgraph, fetchBlastRadius, fetchChokepoints } from '../lib/api'

export function usePackageSubgraph(packageId: string | null, depth?: number) {
  return useQuery({
    queryKey: ['subgraph', packageId, depth],
    queryFn: () => fetchPackageSubgraph(packageId!, depth),
    enabled: packageId !== null,
  })
}

export function useBlastRadius(packageId: string | null) {
  return useQuery({
    queryKey: ['blast-radius', packageId],
    queryFn: () => fetchBlastRadius(packageId!),
    enabled: packageId !== null,
  })
}

export function useChokepoints(params?: { ecosystem?: string; limit?: number }) {
  return useQuery({
    queryKey: ['chokepoints', params],
    queryFn: () => fetchChokepoints(params),
  })
}
