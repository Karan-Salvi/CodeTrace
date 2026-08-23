import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { apiFetch } from "../lib/api-client";
import { useAuth } from "../lib/AuthContext";
import type { CurrentUser } from "../types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardFooter } from "../components/ui/card";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { User } from "lucide-react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
};

export function Settings() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let mounted = true;
    apiFetch<CurrentUser>("/auth/me")
      .then((data) => {
        if (!mounted) return;
        setUser(data);
        setDisplayName(data.displayName ?? data.username);
      })
      .catch(() => {
        // Loaded elsewhere on every protected route already — a failure
        // here just leaves the form blank rather than surfacing a second
        // error banner on top of whatever handleUnauthorized() is doing.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const updated = await apiFetch<CurrentUser>("/auth/me", { method: "PATCH", data: { displayName: trimmed } });
      setUser(updated);
      setDisplayName(updated.displayName ?? updated.username);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Permanently delete your account and all connected repositories? This cannot be undone.")) {
      return;
    }
    setIsDeleting(true);
    setDeleteError("");
    try {
      await apiFetch("/auth/me", { method: "DELETE" });
      await logout();
      navigate("/");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete account");
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full px-lg md:px-xl py-2xl md:py-3xl max-w-[800px] mx-auto pb-4xl">
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-xl">
        <motion.div variants={itemVariants} className="mb-xl">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink mb-xs">Settings</h1>
          <p className="text-body text-[14px]">Manage your account and preferences.</p>
        </motion.div>

        {/* Avatar */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden">
            <div className="p-lg md:p-xl flex items-start justify-between gap-lg">
              <div className="max-w-[480px]">
                <h2 className="text-[16px] font-semibold text-ink mb-xs">Avatar</h2>
                <p className="text-[14px] text-mute leading-relaxed">
                  Your avatar is synced from your GitHub account.
                </p>
              </div>
              <Avatar className="h-16 w-16 border border-hairline shrink-0">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <AvatarFallback className="bg-canvas-soft flex items-center justify-center w-full h-full text-ink">
                    <User className="w-6 h-6 text-mute" />
                  </AvatarFallback>
                )}
              </Avatar>
            </div>
            <CardFooter>
              <p className="text-[13px] text-mute">Change it from your GitHub profile to update it here.</p>
            </CardFooter>
          </Card>
        </motion.div>

        {/* Display Name */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden">
            <div className="p-lg md:p-xl">
              <h2 className="text-[16px] font-semibold text-ink mb-xs">Display Name</h2>
              <p className="text-[14px] text-mute mb-md">Please enter your full name, or a display name you are comfortable with.</p>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={32}
                variant="sm"
                className="max-w-[400px]"
              />
              {saveError && <p className="text-[13px] text-error-deep mt-xs">{saveError}</p>}
            </div>
            <CardFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
              <p className="text-[13px] text-mute">Please use 32 characters at maximum.</p>
              <Button
                variant="primary-sm"
                onClick={handleSave}
                disabled={isSaving || !displayName.trim() || displayName.trim() === (user?.displayName ?? user?.username)}
                className="shrink-0"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>

        {/* Email Address */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden">
            <div className="p-lg md:p-xl">
              <h2 className="text-[16px] font-semibold text-ink mb-xs">Email Address</h2>
              <p className="text-[14px] text-mute mb-md">The email address associated with your CodeTrace account.</p>
              <Input
                value={user?.email ?? "Connected via GitHub"}
                disabled
                variant="sm"
                className="max-w-[400px] text-mute cursor-not-allowed"
              />
            </div>
            <CardFooter>
              <p className="text-[13px] text-mute">You cannot change your email address right now.</p>
            </CardFooter>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div variants={itemVariants} className="mt-3xl!">
          <Card className="overflow-hidden border-error/40">
            <div className="p-lg md:p-xl">
              <h2 className="text-[16px] font-semibold text-ink mb-xs">Delete Account</h2>
              <p className="text-[14px] text-mute max-w-[480px] leading-relaxed">
                Permanently remove your account and all of its contents from the CodeTrace platform. This action is
                not reversible, so please continue with caution.
              </p>
              {deleteError && <p className="text-[13px] text-error-deep mt-sm">{deleteError}</p>}
            </div>
            <CardFooter className="bg-error/10 border-error/40 flex justify-end">
              <Button variant="danger-sm" onClick={handleDelete} disabled={isDeleting} className="shrink-0">
                {isDeleting ? "Deleting..." : "Delete Personal Account"}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
