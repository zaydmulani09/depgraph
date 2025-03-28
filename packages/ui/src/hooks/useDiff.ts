import { useQuery } from '@tanstack/react-query'
import { fetchSnapshotDiff } from '../lib/api'

export function useSnapshotDiff(previousId: string | null, currentId: string | null) {
  return useQuery({
    queryKey: ['snapshot-diff', previousId, currentId],
    queryFn: () => fetchSnapshotDiff(previousId!, currentId!),
    enabled: previousId !== null && currentId !== null,
  })
}
