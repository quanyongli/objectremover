import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Navbar } from "~/components/ui/Navbar";
import { MarketingFooter } from "~/components/ui/MarketingFooter";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { AnimatedGradientText } from "~/components/magicui/animated-gradient-text";
import { UploadDropzone } from "~/components/magicui/upload-dropzone";
import { GradientBorderButton } from "~/components/magicui/gradient-border-button";
import { AnimatedCounter } from "~/components/magicui/animated-counter";
import { AuthModal } from "~/components/ui/AuthModal";
import {
  Target,
  Scissors,
  Bot,
  MousePointerClick,
  Upload as UploadIcon,
  Star,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export default function Landing() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        // TODO: Implement file upload logic
        toast.success("Video uploaded successfully!");
        // Navigate to editor or project page
        // navigate(`/editor?file=${file.name}`);
      } catch (error) {
        toast.error("Failed to upload video");
      } finally {
        setUploading(false);
      }
    },
    [navigate]
  );

  const handleUrlSubmit = useCallback(
    async (url: string) => {
      setUploading(true);
      try {
        // TODO: Implement URL processing logic
        toast.success("Video URL submitted successfully!");
        // navigate(`/editor?url=${encodeURIComponent(url)}`);
      } catch (error) {
        toast.error("Failed to process video URL");
      } finally {
        setUploading(false);
      }
    },
    [navigate]
  );

  const features = [
    {
      title: "AI Object Removal",
      description:
        "Remove unwanted objects from your videos with AI precision. Automatically fill the background seamlessly.",
      icon: Target,
      demoVideo: "/demos/remove-demo.mp4",
    },
    {
      title: "AI Object Extraction",
      description: "Extract specific objects with alpha channel. Perfect for video editing workflows.",
      icon: Scissors,
      demoVideo: "/demos/extract-demo.mp4",
    },
    {
      title: "AI Agent Selection",
      description: "Use natural language to select objects. Just tell AI what you want to remove or extract.",
      icon: Bot,
      demoVideo: "/demos/ai-agent-demo.mp4",
    },
    {
      title: "Click to Select",
      description: "Click on objects directly in the video to select them. Simple and intuitive.",
      icon: MousePointerClick,
      demoVideo: "/demos/click-select-demo.mp4",
    },
  ];

  const steps = [
    {
      number: 1,
      title: "Upload Video",
      description: "Upload your video file or paste a video URL",
      icon: UploadIcon,
    },
    {
      number: 2,
      title: "Select Object",
      description: "Click on the object or use AI Agent to describe what to remove/extract",
      icon: Target,
    },
    {
      number: 3,
      title: "Get Result",
      description: "Download your processed video with object removed or extracted",
      icon: CheckCircle2,
    },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Content Creator",
      rating: 5,
      quote: "ObjectRemover saved me hours of manual editing. The AI precision is incredible!",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    },
    {
      name: "Mike Johnson",
      role: "Video Editor",
      rating: 5,
      quote: "The best tool for removing unwanted objects. It's fast, accurate, and easy to use.",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
    },
    {
      name: "Emily Zhang",
      role: "Marketing Manager",
      rating: 5,
      quote: "Perfect for cleaning up marketing videos. Saves us so much time in post-production.",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background gradient */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[70vw] h-[70vw] max-w-[1000px] bg-gradient-to-br from-blue-500/15 via-purple-500/10 to-pink-500/15 blur-3xl rounded-full" />
          <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-6"
          >
            <Badge variant="outline" className="mb-4">
              <Sparkles className="w-3 h-3 mr-1" />
              NEW AI Object Removal
            </Badge>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-6">
              Remove or Extract Objects from Videos{" "}
              <br className="hidden md:block" />
              <AnimatedGradientText>with AI Magic</AnimatedGradientText>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              ObjectRemover uses advanced AI to precisely remove unwanted objects or extract
              specific objects from your videos with ease.
            </p>

            {/* Upload Area */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-3xl mx-auto mt-12"
            >
              <UploadDropzone
                onFileSelect={handleFileSelect}
                onUrlSubmit={handleUrlSubmit}
                maxSize={500}
              />

              <div className="mt-6">
                <GradientBorderButton
                  size="lg"
                  className="w-full md:w-auto mx-auto"
                  onClick={() => setIsAuthModalOpen(true)}
                >
                  Start Processing Free
                </GradientBorderButton>
              </div>

              <p className="text-sm text-muted-foreground text-center mt-4">
                Try it free. No sign up needed
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-12 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">
                <AnimatedCounter value={100000} suffix="+" />
              </div>
              <p className="text-muted-foreground">Videos Processed</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2 flex items-center justify-center gap-1">
                <AnimatedCounter value={4.9} decimals={1} />
                <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              </div>
              <p className="text-muted-foreground">User Rating</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">
                <AnimatedCounter value={50000} suffix="+" />
              </div>
              <p className="text-muted-foreground">Active Users</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold">AI Features That Actually Work</h2>
            <p className="text-xl text-muted-foreground">
              Powered by advanced AI models for precise object manipulation
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.1 }}
                >
                  <Card className="h-full hover:border-primary/50 transition-colors">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-2xl">{feature.title}</CardTitle>
                      <CardDescription className="text-base">{feature.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Demo video placeholder */}
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">Demo Video</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold">
              From Video to Processed Result, in 3 Simple Steps
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.1 }}
                  className="text-center"
                >
                  <div className="relative inline-flex items-center justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="w-10 h-10 text-primary" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                      {step.number}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-4 mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold">What Users Say About ObjectRemover</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <CardDescription className="text-base italic">
                      "{testimonial.quote}"
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <img
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        className="w-10 h-10 rounded-full"
                      />
                      <div>
                        <p className="font-semibold">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Ready to Remove Objects from Your Videos?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Start processing your videos for free today
            </p>
            <GradientBorderButton size="lg" onClick={() => setIsAuthModalOpen(true)}>
              Get Started Free
            </GradientBorderButton>
            <p className="text-sm text-muted-foreground mt-4">No credit card required</p>
          </motion.div>
        </div>
      </section>

      <MarketingFooter />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          // 登录成功后可以导航到项目页面或刷新用户状态
          toast.success("登录成功！");
          navigate("/dashboard");
        }}
      />
    </div>
  );
}
