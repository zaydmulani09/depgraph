import { useQuery } from '@tanstack/react-query'
import { fetchSnapshots, fetchSnapshot } from '../lib/api'

export function useSnapshots(limit?: number) {
  return useQuery({
    queryKey: ['snapshots', limit],
    queryFn: () => fetchSnapshots(limit),
  })
}

export function useSnapshot(id: string) {
  return useQuery({
    queryKey: ['snapshot', id],
    queryFn: () => fetchSnapshot(id),
    enabled: Boolean(id),
  })
}
