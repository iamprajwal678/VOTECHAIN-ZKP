import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  Lock,
  Cpu,
  ChevronRight,
  Laptop,
  Globe,
  Users,
  Eye,
  ShieldCheck,
  BarChart3,
  ScanFace,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VoteChain ZKP — Anonymous, Tamper-Proof Digital Voting" },
      {
        name: "description",
        content:
          "Cast private, verifiable ballots secured by zero-knowledge proofs and on-device face biometrics. No demo accounts — real, secure authentication.",
      },
      { property: "og:title", content: "VoteChain ZKP — Anonymous Digital Voting" },
      {
        property: "og:description",
        content: "Private, verifiable elections secured by zero-knowledge proofs and biometric face authentication.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Eye,
    title: "Zero-Knowledge Privacy",
    color: "text-cyber-cyan bg-cyber-cyan/10",
    text: "Prove eligibility without revealing identity. Your ballot is mathematically unlinkable to you.",
  },
  {
    icon: ShieldCheck,
    title: "Double-Vote Protection",
    color: "text-cyber-purple bg-cyber-purple/10",
    text: "Unique nullifier hashes prevent duplicate ballots while keeping voters anonymous.",
  },
  {
    icon: ScanFace,
    title: "Biometric Face Auth",
    color: "text-cyber-green bg-cyber-green/10",
    text: "On-device webcam face verification stops impersonation — no images ever leave your device.",
  },
];

const modes = [
  { name: "Student", desc: "University & school governing bodies", icon: Users },
  { name: "Corporate", desc: "Shareholder voting & board proposals", icon: Laptop },
  { name: "Referendum", desc: "Public initiatives & constitutional polls", icon: Globe },
];

function Landing() {
  const { user } = useAuth();
  const portalTo = user ? "/voter" : "/auth";

  return (
    <div className="min-h-screen relative flex flex-col">
      <header className="border-b border-white/5 backdrop-blur-md sticky top-0 z-40 bg-cyber-bg/75 px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl tracking-wider font-mono text-cyber-cyan">
          <Shield className="w-6 h-6 animate-pulse" /> VOTECHAIN ZKP
        </Link>
        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            to="/explorer"
            className="text-muted-foreground hover:text-cyber-cyan transition-colors text-xs sm:text-sm font-mono items-center gap-1 hidden sm:flex"
          >
            <Cpu className="w-4 h-4" /> LEDGER EXPLORER
          </Link>
          <Link to={portalTo} className="btn-cyber-cyan text-xs px-4 py-1.5">
            {user ? "DASHBOARD" : "LAUNCH PORTAL"}
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex-grow flex flex-col gap-16 z-10 relative w-full">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div className="flex flex-col gap-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-xs w-fit font-mono">
              <Lock className="w-3.5 h-3.5" /> ZERO-KNOWLEDGE CRYPTOGRAPHY
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
              The Future of <span className="text-cyber-cyan">Digital Democracy</span> is Anonymous.
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-xl">
              VoteChain ZKP guarantees voter privacy, prevents double voting, and makes election results immune to
              tampering using cryptographic zero-knowledge proofs and biometric face authentication.
            </p>
            <div className="flex flex-wrap gap-4 mt-2">
              <Link to={portalTo} className="btn-cyber-cyan group">
                Get Started <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/explorer" className="btn-cyber-outline">
                <Cpu className="w-4 h-4" /> Explore Ledger
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="glass-card-glow-purple p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden">
              <div className="absolute -right-20 -top-20 w-40 h-40 bg-cyber-cyan/25 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-20 -bottom-20 w-40 h-40 bg-cyber-purple/25 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="text-xs font-mono text-muted-foreground">ZK-PROOF TELEMETRY: ACTIVE</span>
                <span className="w-2.5 h-2.5 rounded-full bg-cyber-green animate-ping" />
              </div>
              <div className="font-mono text-xs text-cyber-cyan bg-black/60 p-4 rounded-lg border border-white/5 space-y-1.5 max-h-[180px] overflow-hidden">
                <div>&gt; Loading voting circuit parameters... [OK]</div>
                <div>&gt; Generating prover key pair (Groth16)...</div>
                <div className="text-cyber-purple">&gt; HashPoseidon(voterSecret, electionId)</div>
                <div className="text-foreground">&gt; Proof Hash: 0x9a83...f81c9a09ef1</div>
                <div className="text-cyber-green">&gt; Solidity pairing verification: VALID</div>
                <div className="text-cyber-green">&gt; Biometric face match: 98.2% confidence</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="glass-card p-6 flex flex-col gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${f.color}`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="border border-white/5 bg-cyber-dark/30 rounded-2xl p-6 sm:p-8 text-center flex flex-col gap-6 items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
              <BarChart3 className="w-6 h-6 text-cyber-cyan" /> Built for Every Voting Paradigm
            </h2>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl mx-auto">
              VoteChain ZKP adapts to the target ecosystem — from campus councils to corporate boards and public
              referendums.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl w-full">
            {modes.map((m) => (
              <div key={m.name} className="p-5 rounded-xl border border-white/5 bg-black/20 text-left flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyber-cyan to-cyber-purple flex items-center justify-center text-cyber-dark">
                  <m.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">{m.name} Mode</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-muted-foreground font-mono z-10 relative bg-cyber-bg/40">
        <p>© 2026 VoteChain ZKP. Secured by zero-knowledge proofs & on-device biometrics.</p>
        <div className="flex justify-center gap-4 mt-2">
          <span className="text-cyber-cyan">ZK Groth16 Verified</span>
          <span>•</span>
          <span className="text-cyber-purple">Biometric Protected</span>
        </div>
      </footer>
    </div>
  );
}
