"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: "http://localhost:3000/api/v1",
  withCredentials: true,
});

function handleAxios(e) {
  const msg =
    e?.response?.data?.message ||
    e?.message ||
    "Request failed";
  const status = e?.response?.status;
  throw new Error(`${status ?? ""} ${msg}`.trim());
}

// GET /space/all
export function useSpaces() {
  return useQuery({
    queryKey: ["spaces"],
    queryFn: async () => {
      try {
        // If your router is mounted at app.use("/api/v1/space", spaceRouter)
        // this path is correct:
        const res = await axiosInstance.get("/space/all");
        console.log(res.data);
        return res.data.spaces ?? [];
      } catch (e) {
        handleAxios(e);
      }
    },
    retry: (count, error) => {
      // don’t retry on auth errors
      return !(error.message.startsWith("401") || error.message.startsWith("403"));
    },
  });
}

// POST /space
export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["spaces", "create"],
    mutationFn: async ({ name, mapId, thumbnail }) => {
      try {
        const res = await axiosInstance.post("/space", { name, mapId, thumbnail });
        return res.data; // { spaceId }
      } catch (e) {
        handleAxios(e);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["spaces"] });
    },
  });
}