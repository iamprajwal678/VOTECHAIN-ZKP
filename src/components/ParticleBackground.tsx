import { useEffect, useRef, useState } from "react";

/**
 * Animated neural-network particle grid rendered on a fixed background canvas.
 */
export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    type P = { x: number; y: number; sx: number; sy: number; size: number; color: string };
    const count = Math.min(60, Math.floor((canvas.width * canvas.height) / 28000));
    const ps: P[] = [];
    for (let i = 0; i < count; i++) {
      ps.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        sx: (Math.random() - 0.5) * 0.5,
        sy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        color: Math.random() > 0.5 ? "rgba(0,242,254,0.4)" : "rgba(127,0,255,0.4)",
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of ps) {
        p.x += p.sx;
        p.y += p.sy;
        if (p.x < 0 || p.x > canvas.width) p.sx = -p.sx;
        if (p.y < 0 || p.y > canvas.height) p.sy = -p.sy;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let a = 0; a < ps.length; a++) {
        for (let b = a + 1; b < ps.length; b++) {
          const dx = ps[a].x - ps[b].x;
          const dy = ps[a].y - ps[b].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.strokeStyle = `rgba(0,242,254,${(1 - dist / 130) * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(ps[a].x, ps[a].y);
            ctx.lineTo(ps[b].x, ps[b].y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (reduced) return <div className="fixed inset-0 -z-10 grid-bg pointer-events-none" />;
  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full -z-10 pointer-events-none" />;
}
