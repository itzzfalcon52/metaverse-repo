"use client"
import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import Navbar from "@/modules/home/components/Navbar";

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [avatars, setAvatars] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_HHTP_URL}/api/v1/me`, { withCredentials: true });
        setUser(response.data.user);
        setSelectedAvatar(response.data.user.avatarKey || "");
      } catch (error) {
        console.error("Error fetching user details:", error);
        toast.error("Failed to fetch user details.");
      }
    };

    const fetchAvatars = async () => {
      try {
        const avatarList = [
          "FemaleAdventurer",
          "FemalePerson",
          "MaleAdventurer",
          "MalePerson",
          "Robot",
          "Zombie",
        ];
        setAvatars(avatarList);
      } catch (error) {
        console.error("Error fetching avatars:", error);
        toast.error("Failed to fetch avatars.");
      }
    };

    fetchUserDetails();
    fetchAvatars();
  }, []);

  const handleAvatarSelect = (avatar) => {
    setSelectedAvatar(avatar);
  };

  const handleAvatarUpdate = async () => {
    if (!selectedAvatar) {
      toast.error("Please select an avatar.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_HHTP_URL}/api/v1/user/avatar`, { avatarKey: selectedAvatar }, { withCredentials: true });
      toast.success("Avatar updated successfully!");
      setUser((prev) => ({ ...prev, avatarKey: selectedAvatar }));
    } catch (error) {
      console.error("Error updating avatar:", error);
      toast.error("Failed to update avatar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white p-6">
      <Navbar/>
      <div className="max-w-6xl mx-auto mt-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 ">
            Your <span className="text-cyan-400">Profile</span>
          </h1>
          <p className="text-gray-400">Manage your account and customize your avatar</p>
        </div>

        {user ? (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column - User Details */}
            <div className="bg-[#151a21] border border-gray-800 rounded-xl p-8">
              <h2 className="text-2xl font-bold mb-6 text-cyan-400">Account Details</h2>
              
              <div className="space-y-6">
                {/* Current Avatar Display */}
                <div className="flex flex-col items-center p-6 bg-[#0b0f14] rounded-lg border border-gray-800">
                  {user.avatarKey ? (
                    <img
                      src={`/avatars/${user.avatarKey}/idle.png`}
                      alt="Current Avatar"
                      className="w-32 h-32 object-contain mb-4"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <p className="text-sm text-gray-400">Current Avatar</p>
                </div>

                {/* User Info */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[#0b0f14] rounded-lg border border-gray-800">
                    <span className="text-gray-400">Username</span>
                    <span className="font-semibold">{user.username}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-[#0b0f14] rounded-lg border border-gray-800">
                    <span className="text-gray-400">Role</span>
                    <span className={`font-semibold ${user.role === 'Admin' ? 'text-cyan-400' : 'text-white'}`}>
                      {user.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#0b0f14] rounded-lg border border-gray-800">
                    <span className="text-gray-400">User ID</span>
                    <span className="font-mono text-sm text-gray-500">{user.id}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Avatar Selection */}
            <div className="bg-[#151a21] border border-gray-800 rounded-xl p-8">
              <h2 className="text-2xl font-bold mb-6 text-cyan-400">Choose Avatar</h2>
              
              {/* Avatar Grid */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {avatars.map((avatar) => (
                  <div
                    key={avatar}
                    className={`relative p-3 bg-[#0b0f14] rounded-lg cursor-pointer transition-all duration-300 border-2 ${
                      selectedAvatar === avatar
                        ? "border-cyan-500 shadow-lg shadow-cyan-500/30"
                        : "border-gray-800 hover:border-gray-700"
                    }`}
                    onClick={() => handleAvatarSelect(avatar)}
                  >
                    <img
                      src={`/avatars/${avatar}/idle.png`}
                      alt={avatar}
                      className="w-full h-24 object-contain"
                    />
                    {selectedAvatar === avatar && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Update Button */}
              <button
                onClick={handleAvatarUpdate}
                disabled={loading || !selectedAvatar}
                className={`w-full py-4 rounded-lg font-semibold transition-all duration-300 ${
                  loading || !selectedAvatar
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg hover:shadow-cyan-500/50"
                }`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Updating...
                  </div>
                ) : (
                  "Update Avatar"
                )}
              </button>

              {selectedAvatar && (
                <p className="text-sm text-gray-400 text-center mt-4">
                  Selected: <span className="text-cyan-400">{selectedAvatar.split('/')[0]}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-12 w-12 text-cyan-400 mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-400">Loading your profile...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;