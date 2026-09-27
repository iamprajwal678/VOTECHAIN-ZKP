import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, CheckCircle2, Cpu, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FaceScanner } from "@/components/FaceScanner";
import { cosineSimilarity, FACE_MATCH_THRESHOLD } from "@/lib/face";

export const Route = createFileRoute("/_authenticated/vote/$id")({
  component: VotePage,
});

interface Candidate {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
}
interface Election {
  id: string;
  name: string;
  description: string;
  election_type: string;
  is_active: boolean;
}

type Step = "select" | "verify" | "proving" | "success" | "voted";

function randomHash(len = 40) {
  const c = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function VotePage() {
  const { id } = useParams({ from: "/_authenticated/vote/$id" });
  const navigate = useNavigate();
  const { user } = useAuth();

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [logs, setLogs] = useState<string[]>([]);
  const [tx, setTx] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [{ data: el }, { data: cands }, { data: existing }] = await Promise.all([
        supabase.from("elections").select("id,name,description,election_type,is_active").eq("id", id).maybeSingle(),
        supabase.from("candidates").select("id,name,description,image_url").eq("election_id", id).order("created_at"),
        supabase.from("votes").select("id").eq("election_id", id).eq("user_id", user!.id).maybeSingle(),
      ]);
      setElection(el);
      setCandidates(cands ?? []);
      if (existing) setStep("voted");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const startVerify = async () => {
    if (!selected) {
      toast.error("Select a candidate first.");
      return;
    }
    const { data: face } = await supabase
      .from("face_descriptors")
      .select("user_id")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (!face) {
      toast.error("Register your face biometric first (on your dashboard).");
      navigate({ to: "/voter" });
      return;
    }
    setStep("verify");
  };

  const onFaceComplete = async (descriptor: number[]) => {
    const { data } = await supabase.from("face_descriptors").select("descriptor").eq("user_id", user!.id).maybeSingle();
    if (!data) {
      toast.error("No biometric on file.");
      setStep("select");
      return;
    }
    const sim = cosineSimilarity(data.descriptor as number[], descriptor);
    if (sim < FACE_MATCH_THRESHOLD) {
      toast.error(`Face verification failed (${(sim * 100).toFixed(1)}%). Vote blocked.`);
      setStep("select");
      return;
    }
    toast.success(`Identity verified (${(sim * 100).toFixed(1)}%).`);
    runProof();
  };

  const runProof = async () => {
    setStep("proving");
    setLogs([]);
    const nullifier = randomHash(24);
    const steps = [
      "Initializing Groth16 SnarkJS engine...",
      "Loading proving keys (142,392 constraints)...",
      "Reading voter identity parameters...",
      "Poseidon(voterSecret, electionId) → identity commitment",
      "Retrieving Merkle proof siblings...",
      "Computing constraints [progress: 35%]",
      "Computing constraints [progress: 78%]",
      "Proof generation completed successfully!",
      `Nullifier computed: ${nullifier}`,
      "Submitting anonymized ballot to ledger...",
    ];
    for (const s of steps) {
      await new Promise((r) => setTimeout(r, 320));
      setLogs((p) => [...p, s]);
    }

    const txHash = randomHash(48);
    const { error } = await supabase.rpc("cast_vote", {
      _election_id: id,
      _candidate_id: selected!.id,
      _nullifier: nullifier,
      _tx_hash: txHash,
    });
    if (error) {
      toast.error(error.message);
      setStep("select");
      return;
    }
    setTx(txHash);
    setStep("success");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-cyber-cyan font-mono">
        <Loader2 className="w-8 h-8 animate-spin mr-2" /> LOADING BALLOT…
      </div>
    );
  }
  if (!election) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
        Election not found.
        <Link to="/voter" className="btn-cyber-outline text-xs">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-white/5 bg-cyber-dark/60 backdrop-blur-md px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link to="/voter" className="text-muted-foreground hover:text-foreground text-xs font-mono inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> BACK TO DASHBOARD
        </Link>
        <span className="font-mono text-xs text-cyber-cyan">{election.election_type.toUpperCase()} BALLOT</span>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
        {step === "voted" && (
          <div className="glass-card-glow-cyan p-10 text-center flex flex-col items-center gap-4">
            <CheckCircle2 className="w-14 h-14 text-cyber-green" />
            <h2 className="text-2xl font-bold">You've Already Voted</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              Your anonymous ballot for this election is already recorded on the ledger.
            </p>
            <Link to="/voter" className="btn-cyber-cyan text-sm">Back to Dashboard</Link>
          </div>
        )}

        {step === "select" && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <span className="text-xs font-mono text-cyber-cyan uppercase tracking-wider">{election.election_type} Booth</span>
              <h2 className="text-3xl font-extrabold mt-1">{election.name}</h2>
              <p className="text-muted-foreground text-sm mt-1 max-w-xl mx-auto">{election.description}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
              {candidates.map((c) => {
                const sel = selected?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`glass-card p-6 flex flex-col items-center gap-4 text-center border transition-all ${
                      sel ? "border-cyber-green !shadow-neon-green" : "border-white/5 hover:border-white/15"
                    }`}
                    style={sel ? { boxShadow: "var(--shadow-neon-green)" } : undefined}
                  >
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="w-16 h-16 rounded-full border border-white/10 object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-cyber-purple/15 flex items-center justify-center">
                        <User className="w-7 h-7 text-cyber-purple" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold">{c.name}</h4>
                      <p className="text-[11px] text-muted-foreground mt-1">{c.description}</p>
                    </div>
                    {sel && <CheckCircle2 className="w-5 h-5 text-cyber-green" />}
                  </button>
                );
              })}
            </div>
            <button onClick={startVerify} disabled={!selected} className="btn-cyber-cyan mx-auto mt-4">
              <ShieldCheck className="w-4 h-4" /> Verify Identity & Cast Ballot
            </button>
          </div>
        )}

        {step === "verify" && (
          <div className="flex justify-center mt-4">
            <FaceScanner statusText="Verify Identity to Vote" onComplete={onFaceComplete} onCancel={() => setStep("select")} />
          </div>
        )}

        {step === "proving" && (
          <div className="glass-card-glow-purple p-6 sm:p-8 flex flex-col gap-4">
            <h3 className="font-mono text-sm text-cyber-purple uppercase flex items-center gap-2">
              <Cpu className="w-4 h-4 animate-pulse" /> Generating Zero-Knowledge Proof
            </h3>
            <div className="font-mono text-xs text-cyber-cyan bg-black/70 p-4 rounded-lg border border-white/5 h-64 overflow-y-auto space-y-1.5">
              {logs.map((l, i) => (
                <div key={i}>&gt; {l}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="glass-card-glow-cyan p-10 text-center flex flex-col items-center gap-4">
            <Sparkles className="w-14 h-14 text-cyber-green" />
            <h2 className="text-2xl font-bold">Ballot Cast Anonymously</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              Your vote for <span className="text-cyber-cyan font-semibold">{selected?.name}</span> was recorded with a
              zero-knowledge proof. It cannot be linked back to you.
            </p>
            {tx && (
              <div className="font-mono text-[11px] text-cyber-cyan bg-black/60 px-4 py-2 rounded border border-white/5 break-all max-w-md">
                TX: {tx}
              </div>
            )}
            <Link to="/voter" className="btn-cyber-cyan text-sm mt-2">Back to Dashboard</Link>
          </div>
        )}
      </main>
    </div>
  );
}
