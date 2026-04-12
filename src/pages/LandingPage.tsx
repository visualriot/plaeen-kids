import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { motion } from 'framer-motion';
import { Calendar, Users, Gamepad2, ChevronDown, Sparkles, ShieldCheck, Zap, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LandingPage = () => {
  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative flex min-h-[95vh] flex-col items-center justify-center px-6 pt-20 text-center">
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
            <Sparkles size={14} /> The Future of Gaming Sessions
          </div>
          <h1 className="font-display text-6xl font-bold leading-[0.9] tracking-tighter md:text-9xl uppercase">
            Unleash the power of <span className="text-plaeen-green">plaeen</span> together.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-white/40 md:text-xl font-bold tracking-widest leading-relaxed uppercase">
            Life gets busy, but gaming with friends shouldn't be. Plaeen makes scheduling sessions effortless, so you can spend more time playing and less time planning.
          </p>

          <div className="mt-12 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
            <div className="relative w-full max-w-sm group">
              <div className="absolute inset-0 bg-plaeen-green/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <input
                type="email"
                placeholder="ENTER YOUR EMAIL"
                className="w-full rounded-2xl border-2 border-white/10 bg-white/5 px-8 py-5 text-white placeholder:text-white/20 focus:border-plaeen-green focus:outline-none transition-all relative z-10 font-bold uppercase tracking-widest"
              />
            </div>
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto px-12 py-8 text-xl font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(118,233,0,0.3)] hover:shadow-[0_0_50px_rgba(118,233,0,0.5)] transition-all">
                Get started
              </Button>
            </Link>
          </div>
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
              <Calendar size={32} />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-tight">Effortless Scheduling</h3>
            <p className="text-white/40 font-medium leading-relaxed">
              Stop juggling calendars. Plaeen finds the perfect time for your next gaming session with friends using advanced sync logic.
            </p>
          </Card>

          <Card className="flex flex-col gap-6 p-10 bg-plaeen-purple/20 border-white/5 hover:border-plaeen-green/30 transition-all group">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.3)] group-hover:scale-110 transition-transform">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-tight">Parental Security</h3>
            <p className="text-white/40 font-medium leading-relaxed">
              Plaeen is a safe space. Robust parental controls ensure kids only join private groups and play age-appropriate games.
            </p>
          </Card>

          <Card className="flex flex-col gap-6 p-10 bg-plaeen-purple/20 border-white/5 hover:border-plaeen-green/30 transition-all group">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.3)] group-hover:scale-110 transition-transform">
              <Zap size={32} />
            </div>
            <h3 className="text-2xl font-bold uppercase tracking-tight">Instant Sync</h3>
            <p className="text-white/40 font-medium leading-relaxed">
              Spend less time planning, more time playing. Real-time updates and notifications keep everyone in the loop.
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
          {[
            "What is Plaeen?",
            "How much does Plaeen cost?",
            "How do I cancel?",
            "How does it work?",
            "Is Plaeen safe for children?"
          ].map((q, i) => (
            <Card key={i} className="flex items-center justify-between p-8 bg-white/5 border-white/5 hover:bg-white/10 transition-all cursor-pointer group">
              <span className="text-lg font-bold uppercase tracking-tight text-white/60 group-hover:text-white transition-colors">{q}</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-plaeen-purple text-plaeen-green group-hover:scale-110 transition-transform">
                <Plus size={24} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="mx-auto max-w-7xl px-6 py-40 text-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(118,233,0,0.05)_0%,transparent_70%)]" />
        <h2 className="font-display text-6xl font-bold uppercase tracking-tighter mb-6">Ready to lose all excuses not to play?</h2>
        <p className="text-white/40 font-bold uppercase tracking-[0.3em] mb-12">Enter your email to create an account.</p>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center relative z-10">
          <div className="relative w-full max-w-sm group">
            <div className="absolute inset-0 bg-plaeen-green/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <input
              type="email"
              placeholder="JOHN.SMITH@GMAIL.COM"
              className="w-full rounded-2xl border-2 border-white/10 bg-white/5 px-8 py-5 text-white placeholder:text-white/20 focus:border-plaeen-green focus:outline-none transition-all font-bold uppercase tracking-widest"
            />
          </div>
          <Link to="/auth">
            <Button size="lg" className="w-full sm:w-auto px-12 py-8 text-xl font-bold uppercase tracking-widest shadow-[0_0_30px_rgba(118,233,0,0.3)]">
              Get started
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
