import { useQuery } from '@tanstack/react-query'
import {
  fetchPackages,
  fetchPackageDetail,
  fetchPackageHistory,
  fetchPackageAdvisories,
  fetchAbandonmentScore,
} from '../lib/api'

export function usePackages(params?: {
  ecosystem?: string
  page?: number
  limit?: number
  sort?: string
}) {
  return useQuery({
    queryKey: ['packages', params],
    queryFn: () => fetchPackages(params),
  })
}

export function usePackageDetail(ecosystem: string, name: string) {
  return useQuery({
    queryKey: ['package', ecosystem, name],
    queryFn: () => fetchPackageDetail(ecosystem, name),
    enabled: Boolean(ecosystem && name),
  })
}

export function usePackageHistory(ecosystem: string, name: string) {
  return useQuery({
    queryKey: ['package-history', ecosystem, name],
    queryFn: () => fetchPackageHistory(ecosystem, name),
    enabled: Boolean(ecosystem && name),
  })
}

export function usePackageAdvisories(ecosystem: string, name: string) {
  return useQuery({
    queryKey: ['package-advisories', ecosystem, name],
    queryFn: () => fetchPackageAdvisories(ecosystem, name),
    enabled: Boolean(ecosystem && name),
  })
}

export function useAbandonmentScore(ecosystem: string, name: string) {
  return useQuery({
    queryKey: ['abandonment', ecosystem, name],
    queryFn: () => fetchAbandonmentScore(ecosystem, name),
    enabled: Boolean(ecosystem && name),
    staleTime: 5 * 60 * 1000, // 5 minutes — computed client-side, no need to refetch often
  })
}
