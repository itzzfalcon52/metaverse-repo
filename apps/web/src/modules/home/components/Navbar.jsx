"use client";

import React from "react";
import Link from "next/link";
import { CircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button"; // shadcn button component
import { useAuth } from "@/hooks/use-auth";

const Navbar = () => {
  const {isSignedIn,handleLogout} = useAuth()  // Simulated authentication status (replace with real logic)

  return (
    <div className="w-full px-10 py-5 flex  justify-between bg-gray-950 text-white shadow-md">
      {/* Logo */}
      <div className="flex items-center space-x-3">
        <Link href="/" className="text-2xl font-bold hover:opacity-80 flex items-center">
          <CircleIcon className="w-6 h-6 text-cyan-400" />
          <span className="ml-2 text-cyan-400">MetaVerse</span>
        </Link>
      </div>

      {/* Navigation Links and Authentication Buttons */}
      <div className="flex items-center space-x-6">
        {/* Navigation Links */}
       
        <Link href="/profile" className="hover:text-cyan-400 transition-colors">
          Profile
        </Link>
        <Link href="/about" className="hover:text-cyan-400 transition-colors">
          About
        </Link>
        <Link href="/contact" className="hover:text-cyan-400 transition-colors">
          Contact
        </Link>

        {/* Authentication Buttons */}
        {isSignedIn ? (
            <>
           <Link href="/spaces" className="hover:text-cyan-400 transition-colors">
           Your Spaces
         </Link>
          <Button
            variant="destructive"
            onClick={() =>handleLogout()}
          >
            Sign Out
          </Button>
          </>
        ) : (
          <>
            <Link href="/login">
              <Button variant="ghost" className="hover:text-cyan-400 bg-indigo-500">
                Login
              </Button>
            </Link>
            <Link href="/get-started">
              <Button variant="default" className="bg-cyan-400 hover:bg-cyan-500">
                Get Started
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default Navbar;