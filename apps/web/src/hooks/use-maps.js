"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import {useRouter} from "next/navigation";


export const axiosInstance = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_HHTP_URL}/api/v1`,
    withCredentials: true, // REQUIRED for cookie-based auth
  });


  export function useMaps() {
    return useQuery({
      queryKey: ["maps"],
      queryFn: async () => {
        // If maps endpoint is admin-protected, keep /admin/maps. Otherwise use /maps.
        const res = await axiosInstance.get("/admin/maps");
        return res.data.maps ?? [];
      },
    });
  }
  
  export function useCreateMap() {
    const qc = useQueryClient();
  
    return useMutation({
      mutationKey: ["maps", "create"],
      mutationFn: async ({ name, width, height, tilemapJson, thumbnail }) => {
        const res = await axiosInstance.post("/admin/map/upload", {
          name,
          width,
          height,
          tilemapJson,
          thumbnail,
        });
        return res.data; // { mapId }
      },
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ["maps"] });
      },
    });
  }
  
  export function useUpdateMapElements() {
    const qc = useQueryClient();
  
    return useMutation({
      mutationKey: ["maps", "updateElements"],
      mutationFn: async ({ mapId, placements }) => {
        const res = await axiosInstance.post(`/admin/maps/${mapId}/elements`, { placements });
        return res.data;
      },
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: ["maps"] });
      },
    });
  }
