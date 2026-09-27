import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, LogOut, Plus, Trash2, BarChart3, Loader2, Lock, Users, Activity } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

interface Candidate {
  id: string;
  name: string;
  description: string;
  vote_count: number;
}
interface ElectionWithCands {
  id: string;
  name: string;
  description: string;
  election_type: string;
  is_active: boolean;
  candidates: Candidate[];
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { profile, isAdmin, loading: authLoading, signOut } = useAuth();
  const [elections, setElections] = useState<ElectionWithCands[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // New election form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("Student");
  const [cands, setCands] = useState<{ name: string; description: string }[]>([
    { name: "", description: "" },
    { name: "", description: "" },
  ]);

  const load = async () => {
    const { data } = await supabase
      .from("elections")
      .select("id,name,description,election_type,is_active,candidates(id,name,description,vote_count)")
      .order("created_at");
    setElections((data ?? []) as unknown as ElectionWithCands[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin]);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  const createElection = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = cands.filter((c) => c.name.trim());
    if (!name.trim() || valid.length < 2) {
      toast.error("Provide an election name and at least 2 candidates.");
      return;
    }
    setCreating(true);
    const { data: el, error } = await supabase
      .from("elections")
      .insert({ name, description, election_type: type, is_active: true })
      .select("id")
      .single();
    if (error || !el) {
      toast.error(error?.message ?? "Failed to create election.");
      setCreating(false);
      return;
    }
    const { error: cErr } = await supabase
      .from("candidates")
      .insert(valid.map((c) => ({ election_id: el.id, name: c.name, description: c.description })));
    if (cErr) {
      toast.error(cErr.message);
    } else {
      toast.success("Election created.");
      setName("");
      setDescription("");
      setCands([{ name: "", description: "" }, { name: "", description: "" }]);
      load();
    }
    setCreating(false);
  };

  const toggleActive = async (el: ElectionWithCands) => {
    await supabase.from("elections").update({ is_active: !el.is_active }).eq("id", el.id);
    load();
  };

  const removeElection = async (id: string) => {
    await supabase.from("elections").delete().eq("id", id);
    toast.success("Election removed.");
    load();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-cyber-cyan">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Lock className="w-12 h-12 text-cyber-magenta" />
        <h2 className="text-xl font-bold">Administrator Access Required</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Your account doesn't have the admin role. Ask a system administrator to grant access.
        </p>
        <Link to="/voter" className="btn-cyber-outline text-sm">Go to Voter Portal</Link>
      </div>
    );
  }

  const totalVotes = elections.reduce(
    (sum, el) => sum + el.candidates.reduce((s, c) => s + c.vote_count, 0),
    0,
  );

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-white/5 bg-cyber-dark/60 backdrop-blur-md px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyber-purple/15 border border-cyber-purple/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-cyber-purple" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Admin Console</h2>
            <p className="text-[10px] font-mono text-muted-foreground">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg border border-white/5 bg-white/5"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 flex flex-col gap-8">
        <div className="grid sm:grid-cols-3 gap-4">
          <Stat icon={BarChart3} label="Elections" value={elections.length} color="text-cyber-cyan" />
          <Stat icon={Users} label="Total Votes" value={totalVotes} color="text-cyber-green" />
          <Stat
            icon={Activity}
            label="Active Now"
            value={elections.filter((e) => e.is_active).length}
            color="text-cyber-purple"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <form onSubmit={createElection} className="glass-card p-6 flex flex-col gap-4 lg:col-span-1 h-fit">
            <h3 className="font-mono text-xs uppercase tracking-wider text-cyber-cyan font-bold flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New Election
            </h3>
            <input className="cyber-input" placeholder="Election name" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea
              className="cyber-input resize-none"
              rows={2}
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <select className="cyber-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option>Student</option>
              <option>Corporate</option>
              <option>Referendum</option>
            </select>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground font-mono uppercase">Candidates</span>
              {cands.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="cyber-input flex-1"
                    placeholder={`Candidate ${i + 1}`}
                    value={c.name}
                    onChange={(e) => setCands((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  {cands.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setCands((p) => p.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive px-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCands((p) => [...p, { name: "", description: "" }])}
                className="text-xs text-cyber-cyan font-mono hover:underline text-left"
              >
                + Add candidate
              </button>
            </div>
            <button type="submit" disabled={creating} className="btn-cyber-cyan w-full">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Election
            </button>
          </form>

          <div className="lg:col-span-2 flex flex-col gap-6">
            <h3 className="font-mono text-sm uppercase tracking-wider text-cyber-cyan font-bold">Manage Elections</h3>
            {elections.length === 0 ? (
              <div className="glass-card p-12 text-center text-muted-foreground text-sm">No elections yet.</div>
            ) : (
              elections.map((el) => {
                const total = el.candidates.reduce((s, c) => s + c.vote_count, 0);
                return (
                  <div key={el.id} className="glass-card p-6 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{el.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {el.election_type} · {total} votes
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(el)}
                          className={`text-[10px] font-mono px-2 py-1 rounded border ${
                            el.is_active
                              ? "text-cyber-green border-cyber-green/30 bg-cyber-green/10"
                              : "text-muted-foreground border-white/10"
                          }`}
                        >
                          {el.is_active ? "● LIVE" : "○ CLOSED"}
                        </button>
                        <button
                          onClick={() => removeElection(el.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete election"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {el.candidates.map((c) => {
                        const pct = total > 0 ? Math.round((c.vote_count / total) * 100) : 0;
                        return (
                          <div key={c.id} className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs">
                              <span>{c.name}</span>
                              <span className="font-mono text-cyber-cyan">
                                {c.vote_count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-purple" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof BarChart3;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-[11px] text-muted-foreground font-mono uppercase">{label}</div>
      </div>
    </div>
  );
}
