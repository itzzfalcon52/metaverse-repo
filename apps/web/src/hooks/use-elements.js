"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

const API = `${process.env.NEXT_PUBLIC_HHTP_URL}/api/v1`;

export function useElements() {
  return useQuery({
    queryKey: ["elements"],
    queryFn: async () => {
      const res = await axios.get(`${API}/elements`, { withCredentials: true });
      return res.data.elements ?? [];
    },
  });
}

export function useImportElements() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ folder = "/elements", static: isStatic = true } = {}) => {
      const res = await axios.post(
        `${API}/admin/elements/import`,
        { folder, static: isStatic },
        { withCredentials: true }
      );
      return res.data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["elements"] });
    },
  });
}