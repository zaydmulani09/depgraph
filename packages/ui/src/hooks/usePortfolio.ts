import { useQuery } from '@tanstack/react-query'
import {
  fetchPortfolioSummary,
  fetchTopRiskyPackages,
  fetchPortfolioChokepoints,
  fetchEcosystemBreakdown,
  fetchPortfolioTrend,
} from '../lib/api'

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: fetchPortfolioSummary,
    staleTime: 60_000,
  })
}

export function useTopRiskyPackages(params?: { ecosystem?: string; limit?: number }) {
  return useQuery({
    queryKey: ['top-risky', params],
    queryFn: () => fetchTopRiskyPackages(params),
  })
}

export function usePortfolioChokepoints(params?: { ecosystem?: string; limit?: number }) {
  return useQuery({
    queryKey: ['portfolio-chokepoints', params],
    queryFn: () => fetchPortfolioChokepoints(params),
  })
}

export function useEcosystemBreakdown() {
  return useQuery({
    queryKey: ['ecosystem-breakdown'],
    queryFn: fetchEcosystemBreakdown,
  })
}

export function usePortfolioTrend(limit?: number) {
  return useQuery({
    queryKey: ['portfolio-trend', limit],
    queryFn: () => fetchPortfolioTrend(limit),
  })
}
