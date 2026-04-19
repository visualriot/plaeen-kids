import React, { useState } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, Gamepad2, ChevronDown, Sparkles, ShieldCheck, Zap, Plus, Minus, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const LandingPage = () => {
  const [heroEmail, setHeroEmail] = useState('');
  const [footerEmail, setFooterEmail] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const navigate = useNavigate();

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/auth?email=${encodeURIComponent(heroEmail)}`);
  };

  const handleFooterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/auth?email=${encodeURIComponent(footerEmail)}`);
  };

  const faqs = [
    {
      q: "What is Plaeen?",
      a: "Plaeen is a social gaming management platform designed for families. It combines robust parental controls with gamified screen time to make gaming safe, scheduled, and drama-free."
    },
    {
      q: "How does the gamification work?",
      a: "Kids earn \"Strikes\" and \"Rewards\" by following their schedule. Finishing on time or completing chores can unlock extra minutes or special privileges, reducing the friction of ending sessions."
    },
    {
      q: "Is it really safe?",
      a: "Yes. Kids can only interact with people parents approve. Our platform restricts games to age-appropriate ratings and provides a private ecosystem for friends to play together."
    },
    {
      q: "How do I sync calendars?",
      a: "Plaeen automatically coordinates availability between friends and family members, suggesting the perfect time for a session and updating everyone's calendar instantly."
    },
    {
      q: "How much does it cost?",
      a: "Get started for free with our basic features. Premium plans are available for families who want advanced scheduling and detailed activity analytics."
    }
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Navigation Header */}
      <nav className="absolute top-0 w-full z-50 px-6 py-8 flex justify-between items-center max-w-7xl left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-plaeen-green text-black font-bold text-xl">P</div>
          <span className="text-xl font-bold tracking-tighter uppercase text-white">Plaeen</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 hover:text-plaeen-green hover:bg-white/5 px-6">
            <Lock size={14} className="mr-2" /> Sign In
          </Button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-[100vh] flex-col items-center justify-center px-6 pt-20 text-center">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <img
            src="https://picsum.photos/seed/cyberpunk-gaming/1920/1080?blur=4"
            alt="Background"
            className="h-full w-full object-cover opacity-20 scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-plaeen-dark/0 via-plaeen-dark/80 to-plaeen-dark" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(118,233,0,0.1)_0%,transparent_50%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-5xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-plaeen-green/10 border border-plaeen-green/20 text-plaeen-green text-[10px] font-bold uppercase tracking-[0.4em] mb-8 animate-pulse">
            <Sparkles size={14} /> The Safest Way to Game Together
          </div>
          <h1 className="font-display text-6xl font-bold leading-[0.9] tracking-tighter md:text-9xl uppercase">
            Unleash the power of <span className="text-plaeen-green">plaeen</span> together.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-white/40 md:text-xl font-bold tracking-widest leading-relaxed uppercase">
            Give your kids a safe gaming platform where they only play with friends. Manage screen time with ease while kids earn rewards for healthy gaming habits.
          </p>

          <form onSubmit={handleHeroSubmit} className="mt-12 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
            <div className="relative w-full max-w-sm group">
              <div className="absolute inset-0 bg-plaeen-green/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <input
                type="email"
                required
                value={heroEmail}
                onChange={(e) => setHeroEmail(e.target.value)}
                placeholder="ENTER YOUR EMAIL"
                className="w-full rounded-2xl border-2 border-white/10 bg-white/5 px-8 py-5 text-white placeholder:text-white/20 focus:border-plaeen-green focus:outline-none transition-all relative z-10 font-bold uppercase tracking-widest"
              />
            </div>
            <Button type="submit" size="lg" className="w-full sm:w-auto px-12 py-8 text-xl font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(118,233,0,0.3)] hover:shadow-[0_0_50px_rgba(118,233,0,0.5)] transition-all">
              Get started
            </Button>
          </form>
        </motion.div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mt-24 text-plaeen-green opacity-50"
        >
          <ChevronDown size={40} />
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-7xl px-6 py-32">
        <div className="text-center mb-20">
          <h2 className="font-display text-5xl font-bold text-white uppercase tracking-tighter">
            Why <span className="text-plaeen-green">Plaeen</span>?
          </h2>
          <div className="h-1 w-20 bg-plaeen-green mx-auto mt-4 rounded-full" />
        </div>
        
        <div className="grid gap-10 md:grid-cols-3">
          <Card className="flex flex-col gap-6 p-10 bg-plaeen-purple/20 border-white/5 hover:border-plaeen-green/30 transition-all group">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.3)] group-hover:scale-110 transition-transform">
              <Sparkles size={32} />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-tight">Gamified Screen Time</h3>
            <p className="text-white/40 font-medium leading-relaxed">
              No more drama. Kids earn rewards and strikes for finishing on time, turning screen time management into a game they want to win.
            </p>
          </Card>

          <Card className="flex flex-col gap-6 p-10 bg-plaeen-purple/20 border-white/5 hover:border-plaeen-green/30 transition-all group">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.3)] group-hover:scale-110 transition-transform">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-tight">Safety & Control</h3>
            <p className="text-white/40 font-medium leading-relaxed">
              Parents have complete overview and control. Your kids only play with confirmed friends, in an environment restricted to safe age ratings.
            </p>
          </Card>

          <Card className="flex flex-col gap-6 p-10 bg-plaeen-purple/20 border-white/5 hover:border-plaeen-green/30 transition-all group">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.3)] group-hover:scale-110 transition-transform">
              <Users size={32} />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-tight">Smart Scheduling</h3>
            <p className="text-white/40 font-medium leading-relaxed">
              Planning sessions with friends is effortless. Instant syncing between family calendars ensures kids stay connected without the headache.
            </p>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mx-auto max-w-4xl px-6 py-32">
        <h2 className="font-display text-5xl font-bold text-white uppercase tracking-tighter text-center mb-16">
          Frequently Asked <span className="text-plaeen-green">Questions</span>
        </h2>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <Card 
              key={i} 
              className={cn(
                "bg-white/5 border-white/5 overflow-hidden transition-all duration-300 hover:bg-white/10",
                openFaq === i ? "bg-white/10" : ""
              )}
            >
              <button 
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-8 transition-all group text-left outline-none"
              >
                <span className={cn(
                  "text-lg font-bold uppercase tracking-tight transition-colors duration-300",
                  openFaq === i ? "text-white" : "text-white/60"
                )}>{faq.q}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-plaeen-purple text-plaeen-green transition-transform duration-300 shrink-0 group-hover:scale-110">
                  {openFaq === i ? <Minus size={24} /> : <Plus size={24} />}
                </div>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="px-8 pb-8 text-white/40 font-medium leading-relaxed">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="mx-auto max-w-7xl px-6 py-40 text-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(118,233,0,0.05)_0%,transparent_70%)]" />
        <h2 className="font-display text-6xl font-bold uppercase tracking-tighter mb-6">Ready to end the screen time battle?</h2>
        <p className="text-white/40 font-bold uppercase tracking-[0.3em] mb-12">Join Plaeen today for a safer, smarter way to play together.</p>
        <form onSubmit={handleFooterSubmit} className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center relative z-10">
          <div className="relative w-full max-w-sm group">
            <div className="absolute inset-0 bg-plaeen-green/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <input
              type="email"
              required
              value={footerEmail}
              onChange={(e) => setFooterEmail(e.target.value)}
              placeholder="JOHN.SMITH@GMAIL.COM"
              className="w-full rounded-2xl border-2 border-white/10 bg-white/5 px-8 py-5 text-white placeholder:text-white/20 focus:border-plaeen-green focus:outline-none transition-all relative z-10 font-bold uppercase tracking-widest"
            />
          </div>
          <Button type="submit" size="lg" className="w-full sm:w-auto px-12 py-8 text-xl font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(118,233,0,0.3)]">
            Get started
          </Button>
        </form>
      </section>
    </div>
  );
};
