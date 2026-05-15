import React, { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/molecules/Card";
import { Heading, Text, Label } from "@/components/atoms";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Users,
  Gamepad2,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Zap,
  Plus,
  Minus,
  Lock,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export const LandingPage = () => {
  const [email, setEmail] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/auth?mode=signup&email=${encodeURIComponent(email)}`);
  };

  const faqs = [
    {
      q: "What is Plaeen?",
      a: "Plaeen is a social gaming management platform designed for families. It combines robust parental controls with gamified screen time to make gaming safe, scheduled, and drama-free.",
    },
    {
      q: "How does the gamification work?",
      a: 'Kids earn "Strikes" and "Rewards" by following their schedule. Finishing on time or completing chores can unlock extra minutes or special privileges, reducing the friction of ending sessions.',
    },
    {
      q: "Is it really safe?",
      a: "Yes. Kids can only interact with people parents approve. Our platform restricts games to age-appropriate ratings and provides a private ecosystem for friends to play together.",
    },
    {
      q: "How do I sync calendars?",
      a: "Plaeen automatically coordinates availability between friends and family members, suggesting the perfect time for a session and updating everyone's calendar instantly.",
    },
    {
      q: "How much does it cost?",
      a: "Get started for free with our basic features. Premium plans are available for families who want advanced scheduling and detailed activity analytics.",
    },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Navigation Header */}
      <nav className="absolute top-0 w-full z-50 px-6 py-8 flex justify-between items-center max-w-7xl left-1/2 -translate-x-1/2">
        <div className="flex flex-row items-center gap-2 z-30">
          <img src="/logo/logo.svg" alt="Plaeen" className="h-12" />
          <img src="/logo/text.svg" alt="Plaeen text" className="h-8 w-auto" />
        </div>
        <Link to="/auth?mode=signin">
          <Button variant="primary" size="sm" className="px-6">
            <Lock size={14} className="mr-2" /> Sign In
          </Button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-screen flex-col items-center justify-end px-6 pt-20 text-center">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <img
            src="/backgrounds/bg_hero_01.png"
            alt="Background"
            className="h-full w-full object-cover object-[50%_100%] opacity-80 scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent from-30% via-plaeen-dark/70 via-50% to-plaeen-dark" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_40%,rgba(0,0,0,1)_100%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-7xl bottom-0"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-plaeen-purple-medium/70 border border-plaeen-green/20 text-plaeen-green mb-8 animate-pulse">
            <Sparkles size={14} />{" "}
            <Text variant="caption" as="span">
              The Safest Way to Game Together
            </Text>
          </div>
          <Heading level={1} variant="display" color="primary">
            Unleash the power of{" "}
            <span className="text-plaeen-green">plaeen</span> together.
          </Heading>
          <Text as="div" className="mx-auto mt-8 max-w-2xl">
            Give your kids a safe gaming platform where they only play with
            friends. Manage screen time with ease while kids earn rewards for
            healthy gaming habits.
          </Text>

          <form
            onSubmit={handleSubmit}
            className="mt-12 flex flex-col w-full items-center gap-6 sm:flex-row sm:justify-center"
          >
            <div className="relative w-full max-w-sm group">
              {/* <div className="absolute inset-0 bg-plaeen-green/5 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" /> */}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ENTER YOUR EMAIL"
                className="w-full rounded-2xl border-2 border-white/40 bg-white/5 px-6 py-8 text-white placeholder:text-white/60 focus:placeholder:text-white/20 focus:border-plaeen-green focus:outline-none focus:bg-plaeen-purple-medium/20 transition-all relative z-10 font-bold"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="text-nowrap"
            >
              Get started
            </Button>
          </form>
        </motion.div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mt-12 mb-8 text-plaeen-green opacity-50"
        >
          <ChevronDown size={40} />
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-7xl px-6 py-32">
        <div className="text-center mb-20">
          <Heading level={2} variant="section" color="primary">
            Why <span className="text-plaeen-green">Plaeen</span>?
          </Heading>
          <div className="h-1 w-20 bg-plaeen-green mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid gap-10 md:grid-cols-3">
          <Card className="flex flex-col gap-6 p-10 bg-plaeen-purple/20 border-white/5 hover:border-plaeen-green/30 transition-all group">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.3)] group-hover:scale-110 transition-transform">
              <Sparkles size={32} />
            </div>
            <Heading level={3} variant="section">
              Gamified Screen Time
            </Heading>
            <Text>
              No more drama. Kids earn rewards and strikes for finishing on
              time, turning screen time management into a game they want to win.
            </Text>
          </Card>

          <Card className="flex flex-col gap-6 p-10 bg-plaeen-purple/20 border-white/5 hover:border-plaeen-green/30 transition-all group">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.3)] group-hover:scale-110 transition-transform">
              <ShieldCheck size={32} />
            </div>
            <Heading level={3} variant="section">
              Safety & Control
            </Heading>
            <Text>
              Parents have complete overview and control. Your kids only play
              with confirmed friends, in an environment restricted to safe age
              ratings.
            </Text>
          </Card>

          <Card className="flex flex-col gap-6 p-10 bg-plaeen-purple/20 border-white/5 hover:border-plaeen-green/30 transition-all group">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-plaeen-green text-black shadow-[0_0_20px_rgba(118,233,0,0.3)] group-hover:scale-110 transition-transform">
              <Users size={32} />
            </div>
            <Heading level={3} variant="section">
              Smart Scheduling
            </Heading>
            <Text>
              Planning sessions with friends is effortless. Instant syncing
              between family calendars ensures kids stay connected without the
              headache.
            </Text>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mx-auto max-w-4xl px-6 py-32 ">
        <Heading level={2} variant="section" color="primary" className="mb-16">
          Frequently Asked <span className="text-plaeen-green">Questions</span>
        </Heading>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <Card
              key={i}
              className={cn(
                "bg-white/5 border-white/5 overflow-hidden transition-all duration-300 hover:bg-white/10",
                openFaq === i ? "bg-white/10" : "",
              )}
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-8 transition-all group text-left outline-none"
              >
                <Heading
                  level={3}
                  variant="section"
                  color={openFaq === i ? "primary" : "muted"}
                  className="transition-colors duration-300"
                >
                  {faq.q}
                </Heading>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl  text-plaeen-green transition-transform duration-300 shrink-0 group-hover:scale-95">
                  {openFaq === i ? <Minus size={32} /> : <Plus size={32} />}
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
                    <div className="px-8 pb-8">
                      <Text color="secondary">{faq.a}</Text>
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
        <Heading level={2} variant="section" color="primary" className="mb-6">
          <span className="text-white">Ready to </span>end the screen time
          battle?
        </Heading>
        <Text className="mb-12 text-xl">
          Join Plaeen today for a safer, smarter way to play together.
        </Text>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center relative z-10"
        >
          <div className="relative w-full max-w-sm group">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ENTER YOUR EMAIL"
              className="w-full rounded-2xl border-2 border-white/40 bg-white/5 px-6 py-8 text-white placeholder:text-white/60 focus:placeholder:text-white/20 focus:border-plaeen-green focus:outline-none focus:bg-plaeen-purple-medium/20 transition-all relative z-10 font-bold"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto px-12 py-8 text-xl font-bold shadow-[0_0_30px_rgba(118,233,0,0.3)]"
          >
            Get started
          </Button>
        </form>
      </section>
    </div>
  );
};
