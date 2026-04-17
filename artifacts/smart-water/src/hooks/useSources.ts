import { useMutation, useQueryClient } from "@tanstack/react-query";

interface UpdateSourcePayload {
  id: number;
  data: {
    name?: string;
    lat?: number;
    lng?: number;
  };
}

export const useUpdateSource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateSourcePayload) => {
      const res = await fetch(`/api/sources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        let errStr = "Gagal memperbarui sumber air";
        try {
          const json = await res.json();
          errStr = json.error || errStr;
        } catch (e) {}
        throw new Error(errStr);
      }
      return res.json();
    },
    // We don't invalidate automatically here to let UI handle specific refreshes if needed,
    // or we can just return it.
  });
};
