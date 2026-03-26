import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, Briefcase, ArrowRight } from "lucide-react";
import hirdanLogo from "@/assets/hirdan-logo.png";

const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border">
    <div className="container flex items-center justify-between h-16">
      <img src={hirdanLogo} alt="Hirdan Marketing" className="h-9" />
      <div className="hidden md:flex items-center gap-8">
        {["Features", "Pricing", "About"].map((item) => (
          <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {item}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm">Log in</Button>
        <Button variant="hero" size="sm">Get Started</Button>
      </div>
    </div>
  </nav>
);

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.6, ease: "easeOut" } }),
};

const Hero = () => (
  <section className="relative min-h-screen flex items-center bg-gradient-hero overflow-hidden pt-16">
    <div className="absolute inset-0 opacity-10">
      <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-secondary blur-[120px]" />
      <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full bg-primary blur-[100px]" />
    </div>
    <div className="container relative z-10 py-24">
      <motion.div className="max-w-3xl" initial="hidden" animate="visible">
        <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-8">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span className="text-sm font-medium text-primary-foreground/70">Agency Management Platform</span>
        </motion.div>
        <motion.h1 variants={fadeUp} custom={1} className="text-5xl md:text-7xl font-display font-bold text-primary-foreground leading-[1.1] mb-6">
          Run Your Agency <br />
          <span className="text-gradient-gold">Like a Pro</span>
        </motion.h1>
        <motion.p variants={fadeUp} custom={2} className="text-lg md:text-xl text-primary-foreground/60 max-w-xl mb-10 font-body">
          Streamline clients, projects, and team workflows in one powerful platform built for modern marketing agencies.
        </motion.p>
        <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-4">
          <Button variant="hero" size="lg" className="text-base px-8 py-6">
            Start Free Trial <ArrowRight className="ml-1" />
          </Button>
          <Button variant="hero-outline" size="lg" className="text-base px-8 py-6">
            Book a Demo
          </Button>
        </motion.div>
        <motion.div variants={fadeUp} custom={4} className="flex items-center gap-8 mt-12">
          {[["500+", "Agencies"], ["10K+", "Projects"], ["99.9%", "Uptime"]].map(([num, label]) => (
            <div key={label}>
              <div className="text-2xl font-display font-bold text-secondary">{num}</div>
              <div className="text-sm text-primary-foreground/50">{label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  </section>
);

const features = [
  { icon: Users, title: "Client Management", desc: "Organize all client data, communications, and history in a centralized hub." },
  { icon: Briefcase, title: "Project Tracking", desc: "Track milestones, deadlines, and deliverables with intuitive Kanban boards." },
  { icon: BarChart3, title: "Analytics & Reports", desc: "Real-time dashboards and automated reports to measure agency performance." },
];

const Features = () => (
  <section id="features" className="py-24 md:py-32">
    <div className="container">
      <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <span className="text-sm font-semibold text-secondary uppercase tracking-wider">Features</span>
        <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mt-3">Everything your agency needs</h2>
      </motion.div>
      <div className="grid md:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="group p-8 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
          >
            <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mb-6 group-hover:bg-gradient-gold transition-colors duration-300">
              <f.icon className="w-6 h-6 text-primary group-hover:text-secondary-foreground transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-display font-semibold text-foreground mb-3">{f.title}</h3>
            <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const CTA = () => (
  <section className="py-24 md:py-32">
    <div className="container">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="relative rounded-3xl bg-gradient-hero p-12 md:p-20 text-center overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-secondary/10 blur-[80px]" />
        <h2 className="text-3xl md:text-5xl font-display font-bold text-primary-foreground mb-6 relative z-10">
          Ready to scale your agency?
        </h2>
        <p className="text-lg text-primary-foreground/60 max-w-xl mx-auto mb-10 relative z-10">
          Join hundreds of agencies already using Hirdan to streamline operations and grow revenue.
        </p>
        <Button variant="hero" size="lg" className="text-base px-10 py-6 relative z-10">
          Get Started Free <ArrowRight className="ml-1" />
        </Button>
      </motion.div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-border py-12">
    <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
      <img src={hirdanLogo} alt="Hirdan Marketing" className="h-8" />
      <p className="text-sm text-muted-foreground">© 2026 Hirdan Marketing. All rights reserved.</p>
    </div>
  </footer>
);

const Index = () => (
  <div className="min-h-screen">
    <Navbar />
    <Hero />
    <Features />
    <CTA />
    <Footer />
  </div>
);

export default Index;
