import { useState } from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } }
};

export function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState("Karan Salvi");

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  };

  return (
    <div className="w-full px-lg md:px-xl py-2xl md:py-3xl max-w-[800px] mx-auto pb-4xl">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-xl"
      >
        <motion.div variants={itemVariants} className="mb-xl">
          <h1 className="text-display-md tracking-[-0.96px] text-ink font-semibold mb-xs">Settings</h1>
          <p className="text-body text-[14px]">Manage your account and preferences.</p>
        </motion.div>

        {/* Avatar Card */}
        <motion.div variants={itemVariants} className="bg-canvas border border-hairline rounded-lg overflow-hidden shadow-sm">
          <div className="p-lg md:p-xl flex items-start justify-between gap-lg">
            <div className="max-w-xl">
              <h2 className="text-[16px] font-semibold text-ink mb-xs">Avatar</h2>
              <p className="text-[14px] text-mute leading-relaxed">This is your avatar.<br />Click on the avatar to upload a custom one from your files.</p>
            </div>
            <Avatar className="h-16 w-16 border border-hairline shadow-sm rounded-full overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
              <AvatarFallback className="bg-canvas-soft flex items-center justify-center w-full h-full text-[20px] font-semibold text-ink">
                KS
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="bg-canvas-soft border-t border-hairline px-lg md:px-xl py-md">
            <p className="text-[13px] text-mute">An avatar is optional but strongly recommended.</p>
          </div>
        </motion.div>

        {/* Display Name Card */}
        <motion.div variants={itemVariants} className="bg-canvas border border-hairline rounded-lg overflow-hidden shadow-sm">
          <div className="p-lg md:p-xl">
            <h2 className="text-[16px] font-semibold text-ink mb-xs">Display Name</h2>
            <p className="text-[14px] text-mute mb-md">Please enter your full name, or a display name you are comfortable with.</p>
            <Input 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
              placeholder="Karan Salvi" 
              className="max-w-[400px] h-9 text-[13px] bg-canvas border-hairline focus:border-mute shadow-sm transition-shadow"
            />
          </div>
          <div className="bg-canvas-soft border-t border-hairline px-lg md:px-xl py-md flex flex-col sm:flex-row sm:items-center justify-between gap-md">
            <p className="text-[13px] text-mute">Please use 32 characters at maximum.</p>
            <Button 
              variant="primary"
              onClick={handleSave} 
              disabled={isSaving} 
              className="w-auto h-auto px-5 py-1.5 text-[13px] font-medium shadow-sm transition-all rounded-md shrink-0 bg-ink text-canvas hover:bg-ink/90 border border-ink"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </motion.div>

        {/* Email Address Card */}
        <motion.div variants={itemVariants} className="bg-canvas border border-hairline rounded-lg overflow-hidden shadow-sm">
          <div className="p-lg md:p-xl">
            <h2 className="text-[16px] font-semibold text-ink mb-xs">Email Address</h2>
            <p className="text-[14px] text-mute mb-md">The email address associated with your CodeTrace account.</p>
            <Input 
              value="karansalviwork@gmail.com" 
              disabled 
              className="max-w-[400px] h-9 text-[13px] bg-canvas-soft border-hairline text-mute cursor-not-allowed shadow-sm"
            />
          </div>
          <div className="bg-canvas-soft border-t border-hairline px-lg md:px-xl py-md">
            <p className="text-[13px] text-mute">You cannot change your email address right now.</p>
          </div>
        </motion.div>

        {/* Danger Zone Card */}
        <motion.div variants={itemVariants} className="bg-canvas border border-hairline rounded-lg overflow-hidden shadow-sm mt-3xl!">
          <div className="p-lg md:p-xl">
            <h2 className="text-[20px] font-semibold text-ink mb-xs">Delete Account</h2>
            <p className="text-[14px] text-mute max-w-xl leading-relaxed">
              Permanently remove your account and all of its contents from the CodeTrace platform. This action is not reversible, so please continue with caution.
            </p>
          </div>
          <div className="bg-error/10 border-t border-hairline px-lg md:px-xl py-md flex justify-end">
            <Button
              className="w-auto h-auto px-lg py-sm shrink-0 text-[14px] font-semibold bg-error text-white border-none hover:bg-error/90 transition-colors cursor-pointer shadow-sm rounded-md"
            >
              Delete Personal Account
            </Button>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
