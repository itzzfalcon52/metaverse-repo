"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import {useRouter} from "next/navigation";

export function useAuth() {
  const queryClient = useQueryClient();
  const router=useRouter();

  

  // Axios instance with credentials enabled for authenticated requests
  const axiosInstance = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true, // Include cookies in requests
  });

  // Fetch user data (requires authentication)
  const getUserData = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      try {
        const response = await axiosInstance.get("/api/v1/me");
        console.log(response.data);
        return response.data.user; // Assuming your `/me` endpoint returns `{ user: {...} }`
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error("You are not logged in.");
        } else {
          console.error("Failed to fetch user data.");
        }
        throw error;
      }
    },
    retry: false, // Disable retries for authentication
  });

  // Handle signup (does not require authentication)
  const handleSignUp = useMutation({
    mutationKey: ["auth", "signup"],
    mutationFn: async ({ username, password }) => {
      const response = await axios.post(`http://localhost:3000/api/v1/signup`, {
        username,
        password,
        type: "user",
      });
      return response.data;
    },
    onSuccess: async (data) => {
      toast.success("Signup successful!");
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] }); // Refetch user data
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Signup failed. Please try again.";
      toast.error(message);
    },
  });

  // Handle login (does not require authentication)
  const handleLogin = useMutation({
    mutationKey: ["auth", "login"],
    mutationFn: async ({ username, password }) => {
      const response = await axios.post(`http://localhost:3000/api/v1/login`, {
        username,
        password,
      },{withCredentials:true});
      console.log(response.data);
      return response.data; //login returns a token 
    },
    onSuccess: async (token) => {
      console.log(token);
      toast.success("Login successful!");
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] }); // Refetch user data
    },
    onError: (error) => {
      const message = error.response?.data?.message || "Login failed. Please try again.";
      toast.error(message);
    },
  });

  const handleLogout = async () => {
    try {
      await axios.post("http://localhost:3000/api/v1/logout", {}, { withCredentials: true });
      toast.success("Logged out successfully.");
    } catch (e) {
      toast.error("Logout failed.");
    } finally {
      queryClient.setQueryData(["auth", "user"], null);
      queryClient.removeQueries({ queryKey: ["auth", "user"] });
      router.replace("/"); // or "/login"
      router.refresh();    // ensure client state revalidates
    }
  };

  

  

  const isSignedIn = !!getUserData.data;

  return {
    getUserData,
    handleSignUp,
    handleLogin,
    isSignedIn,
    handleLogout
  };
}