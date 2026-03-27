import { useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Mail, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import hirdanLogo from "@/assets/hirdan-logo.png";

import { useEffect, useRef } from "react";

const ParticleMesh = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    
    // Configurable density (1 particle per X pixels)
    const density = 20000; 

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      baseX: number;
      baseY: number;
      size: number;

      constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.size = Math.random() * 2.5 + 2;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Responsive mouse interaction radius
        const mouseRadius = Math.min(window.innerWidth, window.innerHeight) * 0.25;

        if (mouseRef.current.active) {
          const dx = mouseRef.current.x - this.x;
          const dy = mouseRef.current.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < mouseRadius) {
            const force = (mouseRadius - distance) / mouseRadius;
            const directionX = dx / distance;
            const directionY = dy / distance;
            this.x -= directionX * force * 1.8;
            this.y -= directionY * force * 1.8;
          }
        }

        if (canvas) {
          if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
          if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(42, 92%, 52%, 0.6)"; 
        ctx.fill();
      }
    }

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Responsive particle count based on screen area
      const area = canvas.width * canvas.height;
      const particleCount = Math.floor(area / density);
      
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(Math.random() * canvas.width, Math.random() * canvas.height));
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Responsive connection distance
      const connectionDistance = Math.min(canvas.width, canvas.height) * 0.2;
      
      particles.forEach((p, index) => {
        p.update();
        p.draw();

        for (let j = index + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            ctx.beginPath();
            ctx.strokeStyle = `hsla(42, 92%, 52%, ${0.35 * (1 - distance / connectionDistance)})`;
            ctx.lineWidth = 1.2;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      init();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };

    init();
    animate();

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-50" />;
};

const ComingSoon = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 40, stiffness: 200 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX - innerWidth / 2) / 20;
    const y = (clientY - innerHeight / 2) / 20;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Failed to subscribe");
      }

      toast.success("Thank you! We'll be in touch soon.");
      setEmail("");
      setIsOpen(false);
    } catch (error) {
      toast.error("Something went wrong. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      onMouseMove={handleMouseMove}
      className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center relative overflow-hidden px-6"
    >
      <ParticleMesh />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Spotlight Gradient following cursor */}
        <motion.div
          style={{
            x: springX,
            y: springY,
            background: "radial-gradient(circle, hsla(var(--secondary), 0.1) 0%, transparent 70%)",
          }}
          className="absolute -inset-[30vw] opacity-60 z-10 pointer-events-none blur-[100px]"
        />

        {/* Soft Background Blobs (Very subtle) */}
        <div className="absolute inset-0 opacity-5">
          <motion.div
            style={{ x: springX, y: springY }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-secondary blur-[120px]"
          />
          <motion.div
            style={{ x: useTransform(springX, (v) => -v * 1.5), y: useTransform(springY, (v) => -v * 1.5) }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-primary blur-[100px]"
          />
        </div>
      </div>

      <div className="container relative z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <img src={hirdanLogo} alt="Hirdan Marketing Management" className="h-14 md:h-16 drop-shadow-2xl" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-sm font-medium text-primary-foreground/70 uppercase tracking-widest">A New Era of Marketing</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-display font-bold text-primary-foreground leading-tight mb-8">
            Elevating Your Brand <br />
            <span className="text-gradient-gold">to New Heights</span>
          </h1>

          <p className="text-lg md:text-xl text-primary-foreground/60 max-w-2xl mx-auto mb-12 font-body font-light leading-relaxed">
            We are hard at work crafting a premium digital experience. Our agency is dedicated to delivering exceptional results through strategic innovation.
          </p>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="hero"
                size="lg"
                className="px-8 py-5 rounded-lg group transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg"
              >
                Notify Me <Mail className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] p-6 bg-card border-white/10 shadow-2xl rounded-xl">
              <DialogHeader className="mb-2">
                <DialogTitle className="text-xl font-display font-bold text-foreground">Get Notified</DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">
                  Be the first to know when we launch and get exclusive updates.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 py-2">
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-secondary transition-colors" />
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-muted border-border/50 text-foreground placeholder:text-muted-foreground/50 rounded-lg focus-visible:ring-secondary focus-visible:border-secondary transition-all"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  variant="hero"
                  className="h-11 text-base rounded-lg group transition-all"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <>Subscribe Now <Send className="ml-2 w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /></>
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-24 flex flex-col items-center gap-4"
        >
          <span className="text-primary-foreground/40 text-sm font-light tracking-widest uppercase text-center px-4">
            © 2026 Hirdan Marketing Management • Developed by Hirdan Marketing
          </span>
          <Link to="/login" className="text-primary-foreground/20 hover:text-primary-foreground/40 text-xs transition-colors">
            Agency Access
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

const Index = () => (
  <ComingSoon />
);

export default Index;
