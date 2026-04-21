/**
 * useNetworkNodes.ts
 * Hook untuk fetch/update nama kustom titik jaringan dari server
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const QUERY_KEY = ["network-node-names"];

/** Fetch all custom node names: { [nodeId]: customName } */
export function useNetworkNodeNames() {
  return useQuery<Record<string, string>>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/network-node-names");
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 30_000,
  });
}

/** Update a single node's name */
export function useUpdateNodeName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nodeId, name }: { nodeId: string; name: string }) => {
      const res = await fetch(`/api/network-node-names/${nodeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
