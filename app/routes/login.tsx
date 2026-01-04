import React, { useState, useEffect } from "react";
import { auth } from "~/lib/auth.server";
import { useNavigate, useSearchParams } from "react-router";
import { AuthModal } from "~/components/ui/AuthModal";
import { Navbar } from "~/components/ui/Navbar";
import { MarketingFooter } from "~/components/ui/MarketingFooter";

export async function loader({ request }: { request: Request }) {
  // If already authenticated, redirect to projects
  try {
    const session = await auth.api?.getSession?.({ headers: request.headers });
    const uid: string | undefined =
      session?.user?.id || session?.session?.userId;
    if (uid)
      return new Response(null, {
        status: 302,
        headers: { Location: "/dashboard" },
      });
  } catch {
    console.error("Login failed");
  }
  return null;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check for error in URL params (from OAuth callback failure)
  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      setErrorMessage(decodeURIComponent(error));
      // Remove error from URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete("error");
      navigate(`/login?${newSearchParams.toString()}`, { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <Navbar />
      
      <div className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Sign In to ObjectRemover
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Get started with your account
          </p>
          
          {errorMessage && (
            <div className="max-w-md mx-auto mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">
                <strong>Authentication Error:</strong> {errorMessage}
              </p>
              <p className="text-red-500 dark:text-red-500 text-xs mt-2">
                Please try again. If the problem persists, check your network connection or contact support.
              </p>
            </div>
          )}
        </div>
      </div>

      <MarketingFooter />

      {/* Auth Modal - 自动打开 */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setErrorMessage(null);
          // 如果用户关闭模态框，导航回首页
          navigate("/");
        }}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          setErrorMessage(null);
          // 登录成功后导航到仪表板
          navigate("/dashboard");
        }}
        onError={(error) => {
          setErrorMessage(error);
        }}
      />
    </div>
  );
}
