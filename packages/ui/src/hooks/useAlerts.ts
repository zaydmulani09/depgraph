import { useQuery } from '@tanstack/react-query'
import { fetchAlerts, fetchAlertCount, type AlertType } from '../lib/api'

export function useAlerts(params?: { limit?: number; type?: AlertType; since?: number }) {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => fetchAlerts(params),
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

export function useAlertCount() {
  return useQuery({
    queryKey: ['alert-count'],
    queryFn: fetchAlertCount,
    staleTime: 30000,
    refetchInterval: 30000,
  })
}
