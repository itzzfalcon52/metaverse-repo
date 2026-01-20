"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { CircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const Navbar = () => {
  const { isSignedIn, handleLogout, getUserData } = useAuth();

  // getUserData is a useQuery(...) result, so the actual user is in getUserData.data
  const user = getUserData?.data ?? null;

  const role = useMemo(() => {
    // supports either { role: "Admin" } or { user: { role: "Admin" } }
    return user?.role ?? user?.user?.role ?? null;
  }, [user]);

  const isAdmin = role === "Admin";

  return (
    <div className="w-full px-10 py-5 flex justify-between bg-gray-950 text-white shadow-md">
      <div className="flex items-center space-x-3">
        <Link href="/" className="text-2xl font-bold hover:opacity-80 flex items-center">
          <CircleIcon className="w-6 h-6 text-cyan-400" />
          <span className="ml-2 text-cyan-400">MetaVerse</span>
        </Link>
      </div>

      <div className="flex items-center space-x-6">
        <Link href="/profile" className="hover:text-cyan-400 transition-colors">
          Profile
        </Link>
        <Link href="/about" className="hover:text-cyan-400 transition-colors">
          About
        </Link>
        <Link href="/contact" className="hover:text-cyan-400 transition-colors">
          Contact
        </Link>

        {/* Only show when signed in AND we have a user role that is Admin */}
        {isSignedIn && isAdmin && (
          <Link href="/admin/maps" className="hover:text-cyan-400 transition-colors">
            Your Maps
          </Link>
        )}

        {isSignedIn ? (
          <>
            <Link href="/spaces" className="hover:text-cyan-400 transition-colors">
              Your Spaces
            </Link>
            <Button variant="destructive" onClick={() => handleLogout()}>
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