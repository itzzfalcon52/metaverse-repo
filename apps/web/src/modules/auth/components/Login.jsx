"use client";

import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";


const Login = () => {
  const { handleLogin, isSignedIn } = useAuth();
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  // Handle form submission
  const onSubmit = (data) => {
    console.log(data);
    handleLogin.mutate(data, {
      onSuccess: () => {
        console.log("Login successful!");
        const params = new window.URLSearchParams(window.location.search);
        const redirectTo = params.get("redirectTo") || "/spaces";
         router.push(redirectTo);
      },
      onError: (error) => {
        console.error("Login failed:", error);
      },
    });
  };

  // If user is already signed in, show a message
 
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0f14]">
      <div className="bg-[#151a21] border border-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-white ">
            Welcome <span className="text-cyan-400">Back</span>
          </h1>
          <p className="text-gray-400">Login to continue your journey in the metaverse</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Username Input */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              {...register("username", { required: "Username is required" })}
              className={`block w-full px-4 py-3 bg-[#0b0f14] text-gray-200 border ${
                errors.username ? "border-red-500" : "border-gray-800"
              } rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all`}
              placeholder="Enter your username"
            />
            {errors.username && (
              <p className="mt-2 text-sm text-red-500">{errors.username.message}</p>
            )}
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              {...register("password", { required: "Password is required" })}
              className={`block w-full px-4 py-3 bg-[#0b0f14] text-gray-200 border ${
                errors.password ? "border-red-500" : "border-gray-800"
              } rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all`}
              placeholder="Enter your password"
            />
            {errors.password && (
              <p className="mt-2 text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full px-4 py-3 text-white font-semibold rounded-lg transition-all duration-300 ${
              handleLogin.isPending
                ? "bg-gray-700 cursor-not-allowed"
                : "bg-cyan-500 hover:bg-cyan-600 shadow-lg hover:shadow-cyan-500/50"
            }`}
            disabled={handleLogin.isPending}
          >
            {handleLogin.isPending ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Logging in...
              </div>
            ) : (
              "Login"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#151a21] text-gray-400">New to the metaverse?</span>
          </div>
        </div>

        {/* Signup Link */}
        <div className="text-center">
          <Link
            href="/signup"
            className="inline-block w-full px-4 py-3 bg-transparent border-2 border-cyan-500 hover:bg-cyan-500/10 text-cyan-400 font-medium rounded-lg transition-all duration-300"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;