import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Wallet,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  HelpCircle,
  LogOut,
  Vote,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FaceScanner } from "@/components/FaceScanner";

export const Route = createFileRoute("/_authenticated/voter")({
  component: VoterDashboard,
});

interface ElectionRow {
  id: string;
  name: string;
  description: string;
  election_type: string;
  is_active: boolean;
}

function VoterDashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut, refresh } = useAuth();
  const [elections, setElections] = useState<ElectionRow[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const [{ data: els }, { data: face }, { data: votes }] = await Promise.all([
      supabase.from("elections").select("id,name,description,election_type,is_active").order("created_at"),
      supabase.from("face_descriptors").select("user_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("votes").select("election_id").eq("user_id", user.id),
    ]);
    setElections(els ?? []);
    setFaceRegistered(!!face);
    setVotedIds(new Set((votes ?? []).map((v) => v.election_id)));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const connectWallet = async () => {
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum;
    if (!eth) {
      toast.error("MetaMask not detected. Install it to link a wallet.");
      return;
    }
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const address = accounts[0];
      await supabase.from("profiles").update({ wallet_address: address }).eq("id", user!.id);
      await refresh();
      toast.success("Wallet linked.");
    } catch {
      toast.error("Wallet connection rejected.");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  const registerFace = async (descriptor: number[]) => {
    const { error } = await supabase
      .from("face_descriptors")
      .upsert({ user_id: user!.id, descriptor, updated_at: new Date().toISOString() });
    if (error) {
      toast.error("Could not save biometric.");
    } else {
      toast.success("Face biometric registered.");
      setFaceRegistered(true);
    }
    setShowScanner(false);
  };

  const wallet = profile?.wallet_address;

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-white/5 bg-cyber-dark/60 backdrop-blur-md px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyber-cyan/15 border border-cyber-cyan/30 flex items-center justify-center font-bold text-cyber-cyan">
            V
          </div>
          <div>
            <h2 className="font-semibold text-sm">Voter Portal</h2>
            <p className="text-[10px] font-mono text-muted-foreground">{profile?.email}</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {wallet ? (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded bg-cyber-cyan/10 border border-cyber-cyan/20 text-xs font-mono text-cyber-cyan">
              <Wallet className="w-3.5 h-3.5" />
              {wallet.slice(0, 6)}…{wallet.slice(-4)}
            </div>
          ) : (
            <button onClick={connectWallet} className="btn-cyber-outline py-1 px-3 text-xs">
              <Wallet className="w-3.5 h-3.5" /> Connect Wallet
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg border border-white/5 bg-white/5"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 grid md:grid-cols-3 gap-8">
        <div className="flex flex-col gap-6">
          <div className="glass-card p-6">
            <h3 className="font-mono text-xs text-muted-foreground border-b border-white/5 pb-2 mb-4 uppercase tracking-wider">
              Voter Security Profile
            </h3>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center border-2 ${
                    faceRegistered ? "border-cyber-green bg-cyber-green/10" : "border-cyber-purple bg-cyber-purple/10"
                  }`}
                >
                  {faceRegistered ? (
                    <UserCheck className="w-8 h-8 text-cyber-green" />
                  ) : (
                    <ShieldAlert className="w-8 h-8 text-cyber-purple" />
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-lg">{profile?.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Eligibility: Verified</p>
              </div>

              {faceRegistered ? (
                <div className="w-full bg-cyber-green/10 border border-cyber-green/20 p-4 rounded-xl text-left flex flex-col gap-2">
                  <div className="text-xs font-mono text-cyber-green font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" /> PROFILE FULLY SECURED
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Webcam biometrics linked. Your ZKP generation keys are unlocked and ready for casting ballots.
                  </p>
                </div>
              ) : (
                <div className="w-full bg-cyber-purple/10 border border-cyber-purple/20 p-4 rounded-xl text-left flex flex-col gap-3">
                  <div className="text-xs font-mono text-cyber-purple font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4" /> ACTION REQUIRED
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Link biometric face credentials to secure your vote submissions.
                  </p>
                  <button onClick={() => setShowScanner(true)} className="btn-cyber-purple text-xs w-full">
                    Register Face Print
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-6 flex flex-col gap-3">
            <h4 className="font-mono text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <HelpCircle className="w-4 h-4 text-cyber-cyan" /> Zero Knowledge Proofs?
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When you vote, a secret nullifier is computed on your device from your private identity key. The system
              validates this proof to confirm you're an eligible voter — without ever learning which ballot is yours.
            </p>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h3 className="font-mono text-sm uppercase tracking-wider text-cyber-cyan font-bold">Active Voting Booths</h3>
            <span className="text-xs font-mono text-muted-foreground">{elections.length} Elections</span>
          </div>

          {loading ? (
            <div className="glass-card p-12 flex items-center justify-center text-cyber-cyan">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : elections.length === 0 ? (
            <div className="glass-card p-12 text-center text-muted-foreground text-sm">No elections configured yet.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              {elections.map((el) => {
                const voted = votedIds.has(el.id);
                return (
                  <div key={el.id} className="glass-card p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20">
                        {el.election_type}
                      </span>
                      <span
                        className={`text-[10px] font-mono ${el.is_active ? "text-cyber-green" : "text-muted-foreground"}`}
                      >
                        {el.is_active ? "● LIVE" : "○ CLOSED"}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-semibold leading-tight">{el.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{el.description}</p>
                    </div>
                    {voted ? (
                      <div className="inline-flex items-center justify-center gap-1.5 text-xs font-mono text-cyber-green border border-cyber-green/20 bg-cyber-green/10 rounded-md py-2">
                        <CheckCircle2 className="w-4 h-4" /> Ballot Cast
                      </div>
                    ) : el.is_active ? (
                      <Link to="/vote/$id" params={{ id: el.id }} className="btn-cyber-cyan text-xs w-full">
                        <Vote className="w-4 h-4" /> Enter Booth
                      </Link>
                    ) : (
                      <button disabled className="btn-cyber-outline text-xs w-full opacity-50">
                        Voting Closed
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <FaceScanner
            statusText="Register Facial Template"
            onComplete={registerFace}
            onCancel={() => setShowScanner(false)}
          />
        </div>
      )}
    </div>
  );
}
