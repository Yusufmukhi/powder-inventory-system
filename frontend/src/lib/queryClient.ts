import { QueryClient } from '@tanstack/react-query'

// Central React Query client.
//
// Why this matters on our stack: the Render free-tier backend cold-starts
// after ~15 min idle, so every network round trip is precious. Without
// caching, every page visit (even revisiting a page you were just on)
// re-triggers a fetch and, if the backend napped, a 30-50s wait.
//
// staleTime: 30s means data fetched once is reused for 30s across every
// component/page that asks for it — no duplicate requests, no refetch on
// quick back-and-forth navigation. Mutations (add/edit/delete) explicitly
// invalidate the relevant query keys, so the UI still updates immediately
// after a write; this only avoids *redundant* reads.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})
