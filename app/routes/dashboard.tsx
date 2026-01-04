import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { useAuth } from "~/hooks/useAuth";
import { ProfileMenu } from "~/components/ui/ProfileMenu";
import { KimuLogo } from "~/components/ui/KimuLogo";
import {
  Upload,
  Link as LinkIcon,
  Scissors,
  Target,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  ArrowRight,
  Coins,
  FileVideo,
  Zap,
  Download,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { auth } from "~/lib/auth.server";

// 任务状态类型
type TaskStatus =
  | "pending"
  | "uploading"
  | "preprocessing"
  | "mask_generating"
  | "processing"
  | "completed"
  | "failed";

type TaskType = "remove" | "extract";

interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  video_url?: string;
  output_video_url?: string;
  credits_cost?: number;
  progress?: number;
  created_at: string;
  updated_at: string;
}

interface DashboardStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  creditsBalance: number;
}

// 服务端 Loader
export async function loader({ request }: { request: Request }) {
  try {
    const session = await auth.api?.getSession?.({ headers: request.headers });
    const uid: string | undefined = session?.user?.id || session?.session?.userId;
    if (!uid) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
    }
    return null;
  } catch {
    return new Response(null, { status: 302, headers: { Location: "/login" } });
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    activeTasks: 0,
    completedTasks: 0,
    creditsBalance: 0,
  });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [starCount, setStarCount] = useState<number | null>(null);

  // 获取统计数据
  useEffect(() => {
    const loadData = async () => {
      try {
        // 获取 Credits 余额
        const creditsRes = await fetch("/api/credits", { credentials: "include" });
        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          setStats((prev) => ({ ...prev, creditsBalance: creditsData.balance || 0 }));
        } else if (creditsRes.status === 404) {
          // API 未实现时使用默认值
          setStats((prev) => ({ ...prev, creditsBalance: 0 }));
        }

        // 获取任务列表
        const tasksRes = await fetch("/api/tasks?limit=5", { credentials: "include" });
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          const tasks = tasksData.tasks || [];
          setRecentTasks(tasks);

          // 计算统计
          setStats((prev) => ({
            ...prev,
            totalTasks: tasks.length,
            activeTasks: tasks.filter((t: Task) =>
              ["pending", "uploading", "preprocessing", "mask_generating", "processing"].includes(
                t.status,
              ),
            ).length,
            completedTasks: tasks.filter((t: Task) => t.status === "completed").length,
          }));
        } else if (tasksRes.status === 404) {
          // API 未实现时使用空数组
          setRecentTasks([]);
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  // 获取 GitHub stars
  useEffect(() => {
    fetch("https://api.github.com/repos/trykimu/videoeditor")
      .then((res) => res.json())
      .then((data) => setStarCount(data.stargazers_count || null))
      .catch(() => setStarCount(null));
  }, []);

  // 任务状态显示
  const getStatusBadge = (status: TaskStatus) => {
    const statusConfig = {
      pending: { label: "等待中", variant: "secondary" as const, icon: Clock },
      uploading: { label: "上传中", variant: "default" as const, icon: Upload },
      preprocessing: { label: "预处理", variant: "default" as const, icon: Loader2 },
      mask_generating: { label: "生成遮罩", variant: "default" as const, icon: Target },
      processing: { label: "处理中", variant: "default" as const, icon: Loader2 },
      completed: { label: "已完成", variant: "default" as const, icon: CheckCircle2 },
      failed: { label: "失败", variant: "destructive" as const, icon: XCircle },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // 获取任务进度百分比
  const getTaskProgress = (task: Task): number => {
    if (task.progress !== undefined) return task.progress;

    const progressMap: Record<TaskStatus, number> = {
      pending: 0,
      uploading: 10,
      preprocessing: 30,
      mask_generating: 50,
      processing: 80,
      completed: 100,
      failed: 0,
    };

    return progressMap[task.status] || 0;
  };

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      {/* 背景网格 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:16px_16px]"
      />

      {/* Header */}
      <header className="h-12 border-b border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2 min-w-0">
          <KimuLogo className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium truncate">ObjectRemover</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Credits 余额显示 */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
            <Coins className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">{stats.creditsBalance} Credits</span>
            {stats.creditsBalance < 50 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => navigate("/payment")}>
                充值
              </Button>
            )}
          </div>
          {user && (
            <ProfileMenu
              user={{ name: user.name, email: user.email, image: user.image }}
              starCount={starCount}
              onSignOut={signOut}
            />
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* 快速开始区域 */}
        <section>
          <h2 className="text-lg font-semibold mb-4">快速开始</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 上传视频卡片 */}
            <Card
              className="group hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => navigate("/upload")}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">上传视频</CardTitle>
                    <CardDescription className="text-xs">本地上传或通过链接</CardDescription>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="outline" className="gap-1">
                    <FileVideo className="h-3 w-3" />
                    本地文件
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <LinkIcon className="h-3 w-3" />
                    YouTube/TikTok
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 创建任务卡片 */}
            <Card
              className="group hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => navigate("/tasks/new")}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">创建新任务</CardTitle>
                    <CardDescription className="text-xs">删除或提取视频中的对象</CardDescription>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="outline" className="gap-1">
                    <Scissors className="h-3 w-3" />
                    删除对象
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Target className="h-3 w-3" />
                    提取对象
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 统计卡片 */}
        <section>
          <h2 className="text-lg font-semibold mb-4">统计概览</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">总任务数</p>
                    <p className="text-2xl font-bold">{stats.totalTasks}</p>
                  </div>
                  <FileVideo className="h-8 w-8 text-muted-foreground/40" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">进行中</p>
                    <p className="text-2xl font-bold text-primary">{stats.activeTasks}</p>
                  </div>
                  <Loader2 className="h-8 w-8 text-primary/40 animate-spin" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">已完成</p>
                    <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-600/40" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Credits 余额</p>
                    <p className="text-2xl font-bold text-primary">{stats.creditsBalance}</p>
                  </div>
                  <Coins className="h-8 w-8 text-primary/40" />
                </div>
                {stats.creditsBalance < 50 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 text-xs"
                    onClick={() => navigate("/payment")}>
                    立即充值
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 最近任务列表 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">最近任务</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/tasks")} className="text-xs">
              查看全部
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="h-20 bg-muted/30 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recentTasks.length === 0 ? (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4 mx-auto border border-border/20">
                  <Zap className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-medium text-muted-foreground/80 mb-2">还没有任务</h3>
                <p className="text-sm text-muted-foreground/60 mb-4">开始你的第一个视频处理任务吧！</p>
                <Button onClick={() => navigate("/upload")}>
                  <Upload className="h-4 w-4 mr-2" />
                  上传视频
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <Card
                  key={task.id}
                  className="group hover:border-primary/50 transition-all cursor-pointer"
                  onClick={() => navigate(`/tasks/${task.id}`)}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(task.status)}
                          <Badge variant="outline" className="text-xs">
                            {task.type === "remove" ? "删除" : "提取"}
                          </Badge>
                          {task.credits_cost && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Coins className="h-3 w-3" />
                              {task.credits_cost} Credits
                            </Badge>
                          )}
                        </div>

                        {/* 进度条 */}
                        {["uploading", "preprocessing", "mask_generating", "processing"].includes(
                          task.status,
                        ) && (
                          <div className="space-y-1 mb-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>处理进度</span>
                              <span>{getTaskProgress(task)}%</span>
                            </div>
                            <Progress value={getTaskProgress(task)} className="h-1.5" />
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            {new Date(task.created_at).toLocaleDateString("zh-CN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {task.status === "completed" && task.output_video_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(task.output_video_url, "_blank");
                              }}>
                              <Download className="h-3 w-3 mr-1" />
                              下载
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* 功能提示卡片 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">AI 智能选择</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">
                使用自然语言描述要删除或提取的对象，AI 自动识别并生成遮罩
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">高质量处理</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">
                基于 ProPainter 和 SAM3 技术，提供专业级的视频对象处理效果
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">快速处理</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-xs">云端处理，实时查看进度，完成后自动通知</CardDescription>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

