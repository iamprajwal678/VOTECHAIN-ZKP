import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Mail, Lock, User as UserIcon, ArrowLeft, Loader2, ScanFace } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { FaceScanner } from "@/components/FaceScanner";
import { cosineSimilarity, FACE_MATCH_THRESHOLD } from "@/lib/face";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — VoteChain ZKP" },
      { name: "description", content: "Securely sign in or create your VoteChain ZKP voter account with face authentication." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";
type Step = "form" | "register-face" | "verify-face";

function AuthPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading, refresh } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Already signed in → route by role
  useEffect(() => {
    if (!authLoading && user && step === "form") {
      navigate({ to: isAdmin ? "/admin" : "/voter", replace: true });
    }
  }, [authLoading, user, isAdmin, step, navigate]);

  const routeByRole = async () => {
    await refresh();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const admin = (roles ?? []).some((r) => r.role === "admin");
    navigate({ to: admin ? "/admin" : "/voter", replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.user) {
          setPendingUserId(data.user.id);
          toast.success("Account created. Let's secure it with face biometrics.");
          setStep("register-face");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { data: face } = await supabase
            .from("face_descriptors")
            .select("user_id")
            .eq("user_id", data.user.id)
            .maybeSingle();
          if (face) {
            setPendingUserId(data.user.id);
            setStep("verify-face");
          } else {
            // No biometric on file yet — register one now.
            setPendingUserId(data.user.id);
            toast.message("Set up face authentication to secure your account.");
            setStep("register-face");
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    await routeByRole();
  };

  const handleRegisterFace = async (descriptor: number[]) => {
    if (!pendingUserId) return;
    const { error } = await supabase
      .from("face_descriptors")
      .upsert({ user_id: pendingUserId, descriptor, updated_at: new Date().toISOString() });
    if (error) {
      toast.error("Could not save biometric. Please retry.");
      setStep("form");
      return;
    }
    toast.success("Face biometric registered. Profile secured.");
    await routeByRole();
  };

  const handleVerifyFace = async (descriptor: number[]) => {
    if (!pendingUserId) return;
    const { data, error } = await supabase
      .from("face_descriptors")
      .select("descriptor")
      .eq("user_id", pendingUserId)
      .maybeSingle();
    if (error || !data) {
      toast.error("No biometric record found.");
      setStep("form");
      return;
    }
    const stored = data.descriptor as number[];
    const sim = cosineSimilarity(stored, descriptor);
    if (sim >= FACE_MATCH_THRESHOLD) {
      toast.success(`Face verified (${(sim * 100).toFixed(1)}% match).`);
      await routeByRole();
    } else {
      await supabase.auth.signOut();
      toast.error(`Face verification failed (${(sim * 100).toFixed(1)}% match). Access denied.`);
      setStep("form");
      setPassword("");
    }
  };

  if (step !== "form") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <FaceScanner
          statusText={step === "register-face" ? "Register Face Biometric" : "Verify Your Identity"}
          onComplete={step === "register-face" ? handleRegisterFace : handleVerifyFace}
          onCancel={async () => {
            await supabase.auth.signOut();
            setStep("form");
            setPendingUserId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="text-muted-foreground hover:text-foreground text-xs font-mono inline-flex items-center gap-1.5 mb-6">
        <ArrowLeft className="w-4 h-4" /> BACK TO HOME
      </Link>

      <div className="glass-card-glow-cyan p-6 sm:p-8 max-w-md w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-cyber-cyan/10 border border-cyber-cyan/30 flex items-center justify-center">
            <Shield className="w-6 h-6 text-cyber-cyan" />
          </div>
          <h1 className="font-mono text-lg text-cyber-cyan font-bold uppercase">Secure Access Portal</h1>
          <p className="text-xs text-muted-foreground">
            {mode === "signin" ? "Sign in and verify your biometric identity." : "Create your account and register face biometrics."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-black/40 border border-white/5">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`py-2 rounded-md text-xs font-mono uppercase transition-all ${
                mode === m ? "bg-cyber-cyan/15 text-cyber-cyan" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground font-mono uppercase">Full Name</span>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="cyber-input pl-9"
                />
              </div>
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-mono uppercase">Email</span>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="cyber-input pl-9"
                autoComplete="email"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-mono uppercase">Password</span>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="cyber-input pl-9"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
          </label>

          <button type="submit" disabled={loading} className="btn-cyber-cyan w-full mt-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />}
            {mode === "signin" ? "Sign In & Verify Face" : "Create Account"}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] text-muted-foreground font-mono">OR</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button onClick={handleGoogle} disabled={loading} className="btn-cyber-outline w-full">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          Continue with Google
        </button>

        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          Protected by zero-knowledge proofs and on-device face biometrics. Your face never leaves your device.
        </p>
        <p className="text-[10px] text-muted-foreground text-center">
          Administrator?{" "}
          <Link to="/admin-auth" className="text-cyber-cyan hover:underline font-mono uppercase">
            Admin Login
          </Link>
        </p>
      </div>
    </div>
  );
}
