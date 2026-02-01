import { Check, Sparkles, Zap, Users, ArrowRight } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Perfect for getting started',
    features: [
      'Full code editor experience',
      'Local file management',
      'Syntax highlighting & themes',
      '25 AI messages per day',
      'Local AI (Ollama) - unlimited',
      'Community support',
    ],
    cta: 'Download Free',
    href: 'https://github.com/LuminaryxApp/sentinelops/releases/latest',
    gradient: 'from-slate-500/20 to-slate-600/20',
    borderColor: 'border-white/5',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 12,
    description: 'For serious developers',
    features: [
      'Everything in Free',
      'Unlimited AI messages',
      'Cloud settings sync',
      'Priority support',
      'All AI models (400+)',
      'Advanced context memory',
      'Custom themes',
    ],
    cta: 'Get Pro',
    href: 'https://luminary243.gumroad.com/l/nngmrj',
    gradient: 'from-cyan/20 to-purple/20',
    borderColor: 'border-cyan/30',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 29,
    description: 'For teams and organizations',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Shared workspaces',
      'Admin dashboard',
      'SSO/SAML support',
      'Audit logs',
      'Dedicated support',
    ],
    cta: 'Get Team',
    href: 'https://luminary243.gumroad.com/l/xzkoj',
    gradient: 'from-purple/20 to-coral/20',
    borderColor: 'border-purple/30',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <div className="relative min-h-screen pt-32 pb-24 px-6">
      {/* Background */}
      <div className="mesh-gradient" />
      <div className="orb orb-cyan w-80 h-80 -top-40 left-1/4 animate-pulse-glow" />
      <div className="orb orb-purple w-96 h-96 top-1/3 -right-48 animate-pulse-glow delay-300" />

      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle mb-6">
            <Sparkles size={14} className="text-cyan" />
            <span className="text-sm text-slate-300">Simple, transparent pricing</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Choose your <span className="gradient-text">plan</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Start free, upgrade when you need unlimited AI and team features.
            All plans include local AI with no limits.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 mb-16">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-3xl overflow-hidden transition-all hover-lift ${
                plan.popular ? 'lg:scale-105 lg:-my-4' : ''
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-cyan to-purple text-center py-2 text-sm font-semibold text-midnight">
                  Most Popular
                </div>
              )}

              <div
                className={`glass-card h-full flex flex-col p-8 border ${plan.borderColor} ${
                  plan.popular ? 'pt-14' : ''
                }`}
              >
                {/* Plan Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-6`}>
                  {plan.id === 'free' && <Zap size={24} className="text-white" />}
                  {plan.id === 'pro' && <Sparkles size={24} className="text-cyan" />}
                  {plan.id === 'team' && <Users size={24} className="text-purple" />}
                </div>

                {/* Plan Name & Description */}
                <h2 className="text-2xl font-bold text-white mb-2">{plan.name}</h2>
                <p className="text-slate-500 text-sm mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-8">
                  {plan.price === 0 ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-white">Free</span>
                      <span className="text-slate-500">forever</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-white">${plan.price}</span>
                      <span className="text-slate-500">/month</span>
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-4 flex-1 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        plan.popular ? 'bg-cyan/20' : 'bg-white/5'
                      }`}>
                        <Check size={12} className={plan.popular ? 'text-cyan' : 'text-slate-400'} />
                      </div>
                      <span className="text-slate-400 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href={plan.href}
                  target={plan.id === 'free' ? '_blank' : undefined}
                  rel={plan.id === 'free' ? 'noopener noreferrer' : undefined}
                  className={`flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? 'btn-primary'
                      : 'border border-white/10 hover:border-cyan/30 hover:bg-cyan/5 text-white'
                  }`}
                >
                  <span>{plan.cta}</span>
                  <ArrowRight size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <div className="glass-card rounded-2xl p-8 max-w-3xl mx-auto text-center">
          <h3 className="text-lg font-semibold text-white mb-3">
            All plans include unlimited local AI
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Use Ollama or LM Studio for completely free, unlimited AI assistance.
            Your code stays on your machine with zero latency.
            Pro and Team checkout links work from within the SentinelOps app.
          </p>
        </div>

        {/* FAQ Quick Links */}
        <div className="mt-16 text-center">
          <p className="text-slate-500 mb-4">Have questions?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/" className="text-sm text-slate-400 hover:text-cyan transition-colors link-underline">
              View FAQ
            </a>
            <a href="/docs" className="text-sm text-slate-400 hover:text-cyan transition-colors link-underline">
              Read Documentation
            </a>
            <a
              href="https://github.com/LuminaryxApp/sentinelops"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-cyan transition-colors link-underline"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
