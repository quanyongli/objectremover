import { Link } from "react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Scissors } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthModal } from "~/components/ui/AuthModal";

interface NavbarProps {
  showBrand?: boolean;
}

export function Navbar({ showBrand = true }: NavbarProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="rounded-xl border border-border/20 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-background/80 shadow-sm px-3 py-2 flex items-center justify-between">
          {/* Fixed width container for brand to prevent layout shift */}
          <div className="w-auto flex items-center justify-start">
            <Link to="/" className="flex items-center gap-2">
              <AnimatePresence mode="wait">
                {showBrand && (
                  <motion.span
                    key="logo-icon"
                    initial={{ opacity: 0, scale: 0.8, x: -10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: -10 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.4, 0.0, 0.2, 1],
                      delay: 0.1,
                    }}
                  >
                    <Scissors className="w-5 h-5 text-foreground" />
                  </motion.span>
                )}
              </AnimatePresence>
              <AnimatePresence mode="wait">
                {showBrand && (
                  <motion.span
                    key="text"
                    className="font-semibold tracking-tight text-lg"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.4, 0.0, 0.2, 1],
                      delay: 0.2,
                    }}
                  >
                    ObjectRemover
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>

          {/* Center navigation - will stay fixed */}
          <nav className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
            <Link
              to="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms
            </Link>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="h-8 px-3 bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#ec4899] text-white hover:opacity-90 transition-opacity"
              onClick={() => setIsAuthModalOpen(true)}
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          // 登录成功后可以刷新页面或导航到项目页面
          window.location.href = "/dashboard";
        }}
      />
    </header>
  );
}
