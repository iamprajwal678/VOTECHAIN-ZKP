import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Cpu, Box, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/explorer")({
  head: () => ({
    meta: [
      { title: "Ledger Explorer — VoteChain ZKP" },
      { name: "description", content: "Browse live, anonymized election tallies and on-chain voting activity on VoteChain ZKP." },
    ],
  }),
  component: Explorer,
});

interface Result {
  id: string;
  name: string;
  election_type: string;
  candidates: { id: string; name: string; vote_count: number }[];
}

const blocks = [
  { n: 489203, hash: "0x092b3c18b76c…2ef9", type: "VoteCast", ago: "40m ago" },
  { n: 489202, hash: "0xfa72fbc09d18…a83f", type: "ElectionCreated", ago: "50m ago" },
  { n: 489201, hash: "0x39a1c890184b…7731", type: "VoterRegistered", ago: "1h ago" },
];

function Explorer() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("elections")
        .select("id,name,election_type,candidates(id,name,vote_count)")
        .order("created_at");
      setResults((data ?? []) as unknown as Result[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen pb-12">
      <header className="border-b border-white/5 bg-cyber-dark/60 backdrop-blur-md px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-muted-foreground hover:text-foreground text-xs font-mono inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> HOME
        </Link>
        <span className="font-mono text-xs text-cyber-cyan inline-flex items-center gap-1.5">
          <Cpu className="w-4 h-4" /> LEDGER EXPLORER
        </span>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 flex flex-col gap-10">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold">Public Ledger Explorer</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Anonymized tallies are public and verifiable. Individual ballots remain private.
          </p>
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-sm uppercase tracking-wider text-cyber-cyan font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Live Election Tallies
          </h2>
          {loading ? (
            <div className="glass-card p-12 flex justify-center text-cyber-cyan">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {results.map((r) => {
                const total = r.candidates.reduce((s, c) => s + c.vote_count, 0);
                return (
                  <div key={r.id} className="glass-card p-6 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">{r.name}</h3>
                      <span className="text-[10px] font-mono text-muted-foreground">{total} votes</span>
                    </div>
                    {r.candidates.map((c) => {
                      const pct = total > 0 ? Math.round((c.vote_count / total) * 100) : 0;
                      return (
                        <div key={c.id} className="flex flex-col gap-1">
                          <div className="flex justify-between text-xs">
                            <span>{c.name}</span>
                            <span className="font-mono text-cyber-cyan">{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyber-cyan to-cyber-purple" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-sm uppercase tracking-wider text-cyber-purple font-bold flex items-center gap-1.5">
            <Box className="w-4 h-4" /> Recent Ledger Activity
          </h2>
          <div className="glass-card divide-y divide-white/5">
            {blocks.map((b) => (
              <div key={b.n} className="flex items-center justify-between p-4 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="text-cyber-cyan">#{b.n}</span>
                  <span className="text-muted-foreground hidden sm:inline">{b.hash}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded bg-cyber-green/10 text-cyber-green border border-cyber-green/20">
                    {b.type}
                  </span>
                  <span className="text-muted-foreground">{b.ago}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
