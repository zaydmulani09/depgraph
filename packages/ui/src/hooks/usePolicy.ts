import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchPolicyRules,
  fetchPolicyViolations,
  resolveViolation,
} from '../lib/api'

export function usePolicyRules() {
  return useQuery({
    queryKey: ['policy-rules'],
    queryFn: fetchPolicyRules,
  })
}

export function usePolicyViolations(params?: {
  packageId?: string
  action?: 'block' | 'warn' | 'require_approval'
  resolved?: boolean
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['policy-violations', params],
    queryFn: () => fetchPolicyViolations(params),
  })
}

export function useResolveViolation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (violationId: string) => resolveViolation(violationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy-violations'] })
    },
  })
}
