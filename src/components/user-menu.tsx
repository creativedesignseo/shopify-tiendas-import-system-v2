"use client";

import { useAuth } from "@/components/auth-provider";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-white/60">
        <User className="h-3.5 w-3.5" />
        <span className="text-[12px] hidden sm:inline truncate max-w-[150px]">
          {user.email}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={signOut}
        className="text-white/40 hover:text-white/80 hover:bg-white/10 h-8 px-2"
      >
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
