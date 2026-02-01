import { useState, useEffect } from 'react';
import { History, ExternalLink, Loader2, Tag } from 'lucide-react';

interface Release {
  tag_name: string;
  name: string;
  published_at: string;
  body: string | null;
  html_url: string;
}

export default function Changelog() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/LuminaryxApp/sentinelops/releases')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setReleases(data.slice(0, 15));
        } else if (data.message) {
          setError(data.message);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="relative min-h-screen pt-32 pb-24 px-6">
        <div className="mesh-gradient" />
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 text-slate-400">
            <Loader2 size={20} className="animate-spin text-cyan" />
            Loading changelog...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-screen pt-32 pb-24 px-6">
        <div className="mesh-gradient" />
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">
            <span className="gradient-text">Changelog</span>
          </h1>
          <div className="glass-card rounded-2xl p-8">
            <p className="text-slate-400 mb-6">Could not load releases: {error}</p>
            <a
              href="https://github.com/LuminaryxApp/sentinelops/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-cyan hover:underline"
            >
              View releases on GitHub
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pt-32 pb-24 px-6">
      {/* Background */}
      <div className="mesh-gradient" />
      <div className="orb orb-cyan w-80 h-80 -top-40 -left-40 animate-pulse-glow" />
      <div className="orb orb-purple w-64 h-64 top-1/3 -right-32 animate-pulse-glow delay-300" />

      <div className="max-w-3xl mx-auto relative">
        {/* Header */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle mb-6">
            <History size={14} className="text-cyan" />
            <span className="text-sm text-slate-300">What's new</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Changelog</span>
          </h1>
          <p className="text-lg text-slate-400">
            Latest updates and improvements to SentinelOps
          </p>
        </div>

        {/* Releases */}
        <div className="space-y-8">
          {releases.map((r, idx) => (
            <article
              key={r.tag_name}
              className={`glass-card rounded-2xl p-8 ${idx === 0 ? 'border-cyan/20' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <a
                  href={r.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xl font-semibold text-white hover:text-cyan transition-colors group"
                >
                  {r.name || r.tag_name}
                  <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-cyan/10 text-cyan rounded-lg">
                    <Tag size={12} />
                    {r.tag_name}
                  </span>
                  <time className="text-sm text-slate-500">
                    {new Date(r.published_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </div>
              </div>
              {r.body && (
                <div
                  className="text-slate-400 text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-a:text-cyan prose-a:no-underline hover:prose-a:underline"
                  dangerouslySetInnerHTML={{
                    __html: r.body
                      .replace(/\n/g, '<br />')
                      .replace(
                        /#(\d+)/g,
                        '<a href="https://github.com/LuminaryxApp/sentinelops/issues/$1" target="_blank" rel="noopener noreferrer">#$1</a>'
                      ),
                  }}
                />
              )}
            </article>
          ))}
        </div>

        {/* Footer link */}
        <div className="mt-12 text-center">
          <a
            href="https://github.com/LuminaryxApp/sentinelops/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan transition-colors"
          >
            View all releases on GitHub
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
