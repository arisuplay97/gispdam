import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Base URL for the API. Assuming Vercel serverless functions are at the same origin.
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export interface Customer {
  id: string;
  nama_pelanggan: string;
  id_pelanggan: string;
  alamat: string;
  elevasi_m: number;
  spam_name: string;
  piutang: number;
  lat: number;
  lng: number;
  created_at?: string;
}

export function useListCustomers() {
  return useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/customers`);
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Customer, "id" | "created_at">) => {
      const res = await fetch(`${API_BASE_URL}/api/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to create customer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Customer) => {
      const res = await fetch(`${API_BASE_URL}/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update customer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/api/customers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete customer");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
