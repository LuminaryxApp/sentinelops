import { Download } from 'lucide-react';

interface DownloadButtonProps {
  platform: string;
  href: string;
}

export default function DownloadButton({ platform, href }: DownloadButtonProps) {
  return (
    <a
      href={href}
      className="group glass-card inline-flex items-center gap-3 px-6 py-4 rounded-2xl font-medium transition-all hover-lift hover:border-cyan/30"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center group-hover:from-cyan/30 group-hover:to-purple/30 transition-colors">
        <Download size={20} className="text-cyan" />
      </div>
      <div className="text-left">
        <div className="text-white text-sm font-semibold">Download for</div>
        <div className="text-cyan text-lg">{platform}</div>
      </div>
    </a>
  );
}
