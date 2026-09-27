import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Shield, Mail, Lock, User as UserIcon, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { signUpAdmin } from "@/lib/admin-auth.functions";

export const Route = createFileRoute("/admin-auth")({
  head: () => ({
    meta: [
      { title: "Admin Login — VoteChain ZKP" },
      { name: "description", content: "Administrator access portal for VoteChain ZKP. Restricted to authorized admins." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAuthPage,
});

type Mode = "signin" | "signup";

function AdminAuthPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const signUpFn = useServerFn(signUpAdmin);

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      navigate({ to: "/admin", replace: true });
    }
  }, [authLoading, user, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpFn({ data: { email, password, name, code } });
        toast.success("Admin account created. Signing you in…");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/admin", replace: true });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.user) throw new Error("Sign-in failed");
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        const admin = (roles ?? []).some((r) => r.role === "admin");
        if (!admin) {
          await supabase.auth.signOut();
          throw new Error("This account is not an administrator.");
        }
        toast.success("Welcome, admin.");
        navigate({ to: "/admin", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="font-mono text-lg text-cyber-cyan font-bold uppercase">Admin Access Portal</h1>
          <p className="text-xs text-muted-foreground">
            {mode === "signin"
              ? "Sign in with administrator credentials."
              : "Create a new administrator account using the admin signup code."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-black/40 border border-white/5">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`py-2 rounded-md text-xs font-mono uppercase transition-all ${
                mode === m ? "bg-cyber-cyan/15 text-cyber-cyan" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "signin" ? "Admin Sign In" : "Create Admin"}
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
                  placeholder="Admin Name"
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
                placeholder="admin@example.com"
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
          {mode === "signup" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground font-mono uppercase">Admin Signup Code</span>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Provided by system owner"
                  className="cyber-input pl-9"
                />
              </div>
            </label>
          )}

          <button type="submit" disabled={loading} className="btn-cyber-cyan w-full mt-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {mode === "signin" ? "Sign In as Admin" : "Create Admin Account"}
          </button>
        </form>

        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          Voters should use the{" "}
          <Link to="/auth" className="text-cyber-cyan hover:underline">
            standard sign-in
          </Link>
          . This portal is restricted to administrators.
        </p>
      </div>
    </div>
  );
}
