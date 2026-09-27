import { useEffect, useRef, useState } from "react";
import { Camera, ScanFace, ShieldCheck, X, AlertTriangle } from "lucide-react";
import { captureFaceDescriptor, averageDescriptors } from "@/lib/face";

interface FaceScannerProps {
  statusText?: string;
  onComplete: (descriptor: number[]) => void;
  onCancel: () => void;
}

/**
 * Live webcam face scanner. Captures real frames and derives a numeric
 * descriptor on-device. No image is uploaded.
 */
export function FaceScanner({ statusText = "Biometric Verification", onComplete, onCancel }: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<number[][]>([]);

  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360, facingMode: "user" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setActive(true);
        }
      } catch {
        setError("Camera access denied. Please allow camera permissions and retry.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Futuristic landmark overlay animation
  useEffect(() => {
    if (!active) return;
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const landmarks = [
      [0.34, 0.38], [0.66, 0.38], [0.5, 0.52], [0.4, 0.66],
      [0.5, 0.68], [0.6, 0.66], [0.26, 0.5], [0.74, 0.5], [0.5, 0.24], [0.5, 0.82],
    ];
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(5,255,199,0.25)";
      ctx.fillStyle = "rgba(5,255,199,0.7)";
      ctx.lineWidth = 1;
      landmarks.forEach(([nx, ny], idx) => {
        const x = nx * canvas.width + Math.sin(Date.now() / 200 + idx) * 1.5;
        const y = ny * canvas.height + Math.cos(Date.now() / 200 + idx) * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const startScan = () => {
    if (!videoRef.current || scanning) return;
    setScanning(true);
    samplesRef.current = [];
    setProgress(0);
    const interval = setInterval(() => {
      const d = videoRef.current ? captureFaceDescriptor(videoRef.current) : null;
      if (d) samplesRef.current.push(d);
      setProgress((p) => {
        const next = p + 10;
        if (next >= 100) {
          clearInterval(interval);
          streamRef.current?.getTracks().forEach((t) => t.stop());
          const avg = averageDescriptors(samplesRef.current);
          if (avg.length === 0) {
            setError("Could not read face. Please retry in better lighting.");
            setScanning(false);
          } else {
            onComplete(avg);
          }
          return 100;
        }
        return next;
      });
    }, 120);
  };

  return (
    <div className="glass-card-glow-cyan p-6 max-w-md w-full flex flex-col gap-4 bg-cyber-bg/95">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="font-mono text-sm text-cyber-cyan font-bold uppercase flex items-center gap-2">
          <ScanFace className="w-4 h-4" /> {statusText}
        </h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="w-10 h-10 text-cyber-magenta" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={onCancel} className="btn-cyber-outline text-xs">Close</button>
        </div>
      ) : (
        <>
          <div className="relative mx-auto w-full aspect-square max-w-[280px] rounded-xl overflow-hidden border border-cyber-cyan/30 bg-black">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover -scale-x-100" />
            <canvas ref={overlayRef} width={280} height={280} className="absolute inset-0 w-full h-full -scale-x-100" />
            {scanning && <div className="scan-line absolute left-0 top-0 animate-scanner" />}
            {!active && (
              <div className="absolute inset-0 flex items-center justify-center text-cyber-cyan font-mono text-xs">
                <Camera className="w-5 h-5 mr-2 animate-pulse" /> Initializing camera…
              </div>
            )}
          </div>

          {scanning ? (
            <div className="flex flex-col gap-2">
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-cyber-green transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-center text-[11px] font-mono text-cyber-green">
                Capturing biometric signature… {progress}%
              </p>
            </div>
          ) : (
            <button onClick={startScan} disabled={!active} className="btn-cyber-cyan w-full">
              <ShieldCheck className="w-4 h-4" /> Start Face Scan
            </button>
          )}
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Your face is processed entirely on this device. Only an anonymized numeric signature is stored.
          </p>
        </>
      )}
    </div>
  );
}
