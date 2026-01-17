"use client";

import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation"; // For redirection
import Link from "next/link"; // For navigation links

const Signup = () => {
  const { handleSignUp } = useAuth(); // Access the handleSignUp mutation
  const router = useRouter(); // Initialize useRouter for navigation
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm(); // Initialize react-hook-form

  // Handle form submission
  const onSubmit = (data) => {
    handleSignUp.mutate(data, {
      onSuccess: () => {
        console.log("Signup successful!");
        router.push("/login"); // Redirect to login page on successful signup
      },
      onError: (error) => {
        console.error("Signup failed:", error);
      },
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950">
      <div className="bg-gray-900 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-cyan-400 text-center mb-6">Signup</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Username Input */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300">
              Username
            </label>
            <input
              type="text"
              id="username"
              {...register("username", { required: "Username is required" })}
              className={`mt-1 block w-full px-3 py-2 bg-gray-800 text-gray-200 border ${
                errors.username ? "border-red-500" : "border-gray-700"
              } rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm`}
              placeholder="Enter your username"
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-500">{errors.username.message}</p>
            )}
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              type="password"
              id="password"
              {...register("password", { required: "Password is required" })}
              className={`mt-1 block w-full px-3 py-2 bg-gray-800 text-gray-200 border ${
                errors.password ? "border-red-500" : "border-gray-700"
              } rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm`}
              placeholder="Enter your password"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full px-4 py-2 text-white font-medium rounded-md ${
              handleSignUp.isPending ? "bg-cyan-300" : "bg-cyan-500 hover:bg-cyan-600"
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500`}
            disabled={handleSignUp.isPending}
          >
            {handleSignUp.isPending ? "Signing up..." : "Signup"}
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="text-cyan-400 hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;