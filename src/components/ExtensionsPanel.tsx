import { useState, useEffect } from 'react';
import { Package, Search, Download, Trash2, Check, Loader2, ExternalLink, RefreshCw, X, FolderOpen, Star, StarHalf, GitBranch, Calendar, Tag, Scale } from 'lucide-react';
import { api, ExtensionInfo } from '../services/api';
import { useStore } from '../hooks/useStore';
import { extensionService } from '../services/extensionService';

type TabType = 'vscode' | 'installed' | 'search';

// Helper function to format download count
function formatDownloadCount(count: number | undefined): string {
  if (!count) return '-';
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// Helper function to format date
function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return dateString;
  }
}

// Star rating component
function StarRating({ rating, reviewCount }: { rating?: number; reviewCount?: number }) {
  if (!rating) return null;

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} className="h-3.5 w-3.5 fill-[#FFB900] text-[#FFB900]" />
        ))}
        {hasHalfStar && <StarHalf className="h-3.5 w-3.5 fill-[#FFB900] text-[#FFB900]" />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} className="h-3.5 w-3.5 text-[#3E3E42]" />
        ))}
      </div>
      <span className="text-xs text-[#858585]">
        {rating.toFixed(1)} {reviewCount !== undefined && `(${reviewCount})`}
      </span>
    </div>
  );
}

export default function ExtensionsPanel() {
  const { addNotification, settings, updateSettings, incrementIconThemeVersion } = useStore();
  const [activeTab, setActiveTab] = useState<TabType>('vscode');
  const [vscodeExtensions, setVscodeExtensions] = useState<ExtensionInfo[]>([]);
  const [installedExtensions, setInstalledExtensions] = useState<ExtensionInfo[]>([]);
  const [searchResults, setSearchResults] = useState<ExtensionInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [extensionIdInput, setExtensionIdInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const [selectedExtension, setSelectedExtension] = useState<ExtensionInfo | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Auto-apply themes from a newly installed extension
  const autoApplyExtensionThemes = async (extensionId: string) => {
    // Reload contributions to pick up the new extension
    const contributions = await extensionService.loadContributions();

    // Check if this extension has color themes
    const extensionThemes = contributions.themes.filter(t =>
      t.extensionId.toLowerCase() === extensionId.toLowerCase()
    );

    // Check if this extension has icon themes
    const extensionIconThemes = contributions.iconThemes.filter(t =>
      t.extensionId.toLowerCase() === extensionId.toLowerCase()
    );

    // Auto-apply color theme if user doesn't have one set
    if (extensionThemes.length > 0 && !settings.colorTheme) {
      const theme = extensionThemes[0];
      const colors = await extensionService.loadTheme(theme);
      if (colors) {
        extensionService.applyTheme(colors);
        updateSettings({ colorTheme: `${theme.extensionId}:${theme.id}` });
        addNotification({
          type: 'success',
          title: 'Theme Applied',
          message: `${theme.label} has been automatically applied`,
        });
      }
    } else if (extensionThemes.length > 0) {
      // User already has a theme, just notify
      addNotification({
        type: 'info',
        title: 'Theme Available',
        message: `${extensionThemes[0].label} is now available in Settings`,
      });
    }

    // Auto-apply icon theme if user doesn't have one set
    if (extensionIconThemes.length > 0 && !settings.iconTheme) {
      const iconTheme = extensionIconThemes[0];
      await extensionService.loadIconTheme(iconTheme);
      updateSettings({ iconTheme: `${iconTheme.extensionId}:${iconTheme.id}` });
      incrementIconThemeVersion();
      addNotification({
        type: 'success',
        title: 'Icon Theme Applied',
        message: `${iconTheme.label} has been automatically applied`,
      });
    } else if (extensionIconThemes.length > 0) {
      // User already has an icon theme, just notify
      addNotification({
        type: 'info',
        title: 'Icon Theme Available',
        message: `${extensionIconThemes[0].label} is now available in Settings`,
      });
    }
  };

  // Load VSCode extensions on mount
  useEffect(() => {
    loadVscodeExtensions();
    loadInstalledExtensions();
  }, []);

  const loadVscodeExtensions = async () => {
    setIsLoading(true);
    const res = await api.listVscodeExtensions();
    if (res.ok && res.data) {
      setVscodeExtensions(res.data.extensions);
    }
    setIsLoading(false);
  };

  const loadInstalledExtensions = async () => {
    const res = await api.listInstalledExtensions();
    if (res.ok && res.data) {
      setInstalledExtensions(res.data.extensions);
    }
  };

  const searchExtensions = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    const res = await api.searchOpenvsx(searchQuery);
    if (res.ok && res.data) {
      setSearchResults(res.data.extensions);
    } else {
      addNotification({
        type: 'error',
        title: 'Search failed',
        message: res.error?.message || 'Could not search extensions',
      });
    }
    setIsLoading(false);
  };

  const installById = async () => {
    if (!extensionIdInput.trim()) return;
    const extId = extensionIdInput.trim();
    setInstallingId(extId);
    const res = await api.installExtension(extId);
    if (res.ok && res.data) {
      addNotification({
        type: 'success',
        title: 'Extension installed',
        message: `${res.data.name} has been installed`,
      });
      loadInstalledExtensions();
      setExtensionIdInput('');

      // Auto-apply themes from newly installed extension
      await autoApplyExtensionThemes(extId);
    } else {
      addNotification({
        type: 'error',
        title: 'Installation failed',
        message: res.error?.message || 'Could not install extension',
      });
    }
    setInstallingId(null);
  };

  const installExtension = async (ext: ExtensionInfo) => {
    setInstallingId(ext.id);
    const res = await api.installExtension(ext.id);
    if (res.ok && res.data) {
      addNotification({
        type: 'success',
        title: 'Extension installed',
        message: `${res.data.name} has been installed`,
      });
      loadInstalledExtensions();
      // Update the extension in current list to show as installed
      if (activeTab === 'vscode') {
        setVscodeExtensions(prev => prev.map(e => e.id === ext.id ? { ...e, installed: true } : e));
      } else if (activeTab === 'search') {
        setSearchResults(prev => prev.map(e => e.id === ext.id ? { ...e, installed: true } : e));
      }

      // Auto-apply themes from newly installed extension
      await autoApplyExtensionThemes(ext.id);
    } else {
      addNotification({
        type: 'error',
        title: 'Installation failed',
        message: res.error?.message || 'Could not install extension',
      });
    }
    setInstallingId(null);
  };

  const uninstallExtension = async (ext: ExtensionInfo) => {
    if (!confirm(`Uninstall ${ext.name}?`)) return;
    setUninstallingId(ext.id);
    const res = await api.uninstallExtension(ext.id);
    if (res.ok) {
      addNotification({
        type: 'success',
        title: 'Extension uninstalled',
        message: `${ext.name} has been removed`,
      });
      loadInstalledExtensions();
    } else {
      addNotification({
        type: 'error',
        title: 'Uninstall failed',
        message: res.error?.message || 'Could not uninstall extension',
      });
    }
    setUninstallingId(null);
  };

  const isInstalled = (extId: string) => {
    return installedExtensions.some(e => e.id.toLowerCase() === extId.toLowerCase());
  };

  // Open extension details with additional fetch from Open-VSX
  const openExtensionDetails = async (ext: ExtensionInfo) => {
    setSelectedExtension(ext);

    // If this is from search or doesn't have rich metadata, fetch it
    if (!ext.installed || !ext.downloadCount) {
      setLoadingDetails(true);
      const res = await api.getOpenvsxExtension(ext.id);
      if (res.ok && res.data) {
        setSelectedExtension({ ...ext, ...res.data, installed: ext.installed, path: ext.path });
      }
      setLoadingDetails(false);
    }
  };

  const renderExtensionList = (extensions: ExtensionInfo[], showInstall = true) => (
    <div className="space-y-2">
      {extensions.length === 0 ? (
        <div className="text-center py-8 text-[#858585]">
          <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No extensions found</p>
        </div>
      ) : (
        extensions.map((ext) => {
          const installed = isInstalled(ext.id);
          return (
            <div
              key={ext.id}
              onClick={() => openExtensionDetails(ext)}
              className="flex items-start gap-3 p-3 bg-[#252526] rounded-lg border border-[#3E3E42] hover:border-[#007ACC] transition-colors cursor-pointer"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded bg-[#3C3C3C] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {ext.icon ? (
                  <img src={ext.icon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-6 w-6 text-[#858585]" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{ext.name}</span>
                  <span className="text-xs text-[#858585]">v{ext.version}</span>
                  {installed && (
                    <span className="text-xs bg-[#89D185]/20 text-[#89D185] px-1.5 py-0.5 rounded">
                      Installed
                    </span>
                  )}
                  {ext.preview && (
                    <span className="text-xs bg-[#FF8C00]/20 text-[#FF8C00] px-1.5 py-0.5 rounded">
                      Preview
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#858585] mb-1">{ext.publisher}</p>
                {ext.description && (
                  <p className="text-xs text-[#858585] line-clamp-2">{ext.description}</p>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-3 mt-2">
                  {ext.downloadCount !== undefined && (
                    <span className="text-xs text-[#858585] flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      {formatDownloadCount(ext.downloadCount)}
                    </span>
                  )}
                  {ext.averageRating !== undefined && (
                    <StarRating rating={ext.averageRating} reviewCount={ext.reviewCount} />
                  )}
                  {ext.license && (
                    <span className="text-xs text-[#858585] flex items-center gap-1">
                      <Scale className="h-3 w-3" />
                      {ext.license}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                {showInstall && !installed && (
                  <button
                    onClick={() => installExtension(ext)}
                    disabled={installingId === ext.id}
                    className="btn btn-sm btn-primary flex items-center gap-1"
                  >
                    {installingId === ext.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    Install
                  </button>
                )}
                {installed && activeTab === 'installed' && (
                  <button
                    onClick={() => uninstallExtension(ext)}
                    disabled={uninstallingId === ext.id}
                    className="btn btn-sm bg-[#F48771]/20 text-[#F48771] hover:bg-[#F48771]/30 flex items-center gap-1"
                  >
                    {uninstallingId === ext.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Remove
                  </button>
                )}
                {installed && activeTab !== 'installed' && (
                  <span className="text-xs text-[#89D185] flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Installed
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // Extension detail modal
  const renderExtensionDetail = () => {
    if (!selectedExtension) return null;
    const installed = isInstalled(selectedExtension.id);
    const ext = selectedExtension;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedExtension(null)}>
        <div className="bg-[#1E1E1E] border border-[#3E3E42] rounded-lg shadow-2xl w-[700px] max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header with gradient background */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[#007ACC]/20 to-transparent" />
            <div className="relative flex items-start gap-4 p-6">
              <div className="w-24 h-24 rounded-xl bg-[#252526] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg border border-[#3E3E42]">
                {ext.icon ? (
                  <img src={ext.icon} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-12 w-12 text-[#858585]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-white">{ext.name}</h2>
                  {ext.preview && (
                    <span className="text-xs bg-[#FF8C00]/20 text-[#FF8C00] px-2 py-0.5 rounded-full">
                      Preview
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#858585] mb-2">{ext.publisher}</p>

                {/* Version and Install status */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs bg-[#3C3C3C] px-2 py-1 rounded">v{ext.version}</span>
                  {installed && (
                    <span className="text-xs bg-[#89D185]/20 text-[#89D185] px-2 py-1 rounded flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Installed
                    </span>
                  )}
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 flex-wrap">
                  {ext.downloadCount !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <Download className="h-4 w-4 text-[#007ACC]" />
                      <span className="text-sm font-medium">{formatDownloadCount(ext.downloadCount)}</span>
                      <span className="text-xs text-[#858585]">downloads</span>
                    </div>
                  )}
                  {ext.averageRating !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <StarRating rating={ext.averageRating} reviewCount={ext.reviewCount} />
                    </div>
                  )}
                  {ext.lastUpdated && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-[#858585]" />
                      <span className="text-xs text-[#858585]">{formatDate(ext.lastUpdated)}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedExtension(null)}
                className="p-1 hover:bg-[#3E3E42] rounded absolute top-4 right-4"
              >
                <X className="h-5 w-5 text-[#858585]" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[400px] space-y-6">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#007ACC]" />
              </div>
            ) : (
              <>
                {/* Description */}
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">Description</h3>
                  <p className="text-sm text-[#CCCCCC] leading-relaxed">
                    {ext.description || 'No description available'}
                  </p>
                </div>

                {/* Categories */}
                {ext.categories && ext.categories.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-white mb-2">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {ext.categories.map((category, i) => (
                        <span
                          key={i}
                          className="text-xs bg-[#094771] text-[#75BEFF] px-2.5 py-1 rounded-full"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {ext.tags && ext.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-1.5">
                      <Tag className="h-4 w-4" />
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {ext.tags.slice(0, 15).map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs bg-[#3C3C3C] text-[#CCCCCC] px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {ext.tags.length > 15 && (
                        <span className="text-xs text-[#858585]">
                          +{ext.tags.length - 15} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Resources & Details */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Left column */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-white">Resources</h3>

                    {ext.repository && (
                      <a
                        href={ext.repository}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-[#007ACC] hover:underline"
                      >
                        <GitBranch className="h-4 w-4" />
                        Repository
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    {ext.homepage && ext.homepage !== ext.repository && (
                      <a
                        href={ext.homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-[#007ACC] hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Homepage
                      </a>
                    )}

                    <a
                      href={`https://open-vsx.org/extension/${ext.publisher}/${ext.name.toLowerCase().replace(/\s+/g, '-')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-[#007ACC] hover:underline"
                    >
                      <Package className="h-4 w-4" />
                      Open-VSX Page
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Right column - Details */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-white">Details</h3>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#858585]">Extension ID</span>
                      <code className="text-[#D4D4D4] bg-[#3C3C3C] px-2 py-0.5 rounded text-xs">{ext.id}</code>
                    </div>

                    {ext.license && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#858585] flex items-center gap-1">
                          <Scale className="h-3.5 w-3.5" />
                          License
                        </span>
                        <span className="text-[#D4D4D4]">{ext.license}</span>
                      </div>
                    )}

                    {ext.lastUpdated && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#858585] flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Updated
                        </span>
                        <span className="text-[#D4D4D4]">{formatDate(ext.lastUpdated)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Installation path for installed extensions */}
                {ext.path && (
                  <div>
                    <h3 className="text-sm font-medium text-white mb-2">Installation Path</h3>
                    <div className="flex items-center gap-2 bg-[#252526] p-2 rounded border border-[#3E3E42]">
                      <FolderOpen className="h-4 w-4 text-[#DCB67A]" />
                      <code className="text-xs text-[#CCCCCC] truncate flex-1" title={ext.path}>
                        {ext.path}
                      </code>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 p-4 border-t border-[#3E3E42] bg-[#252526]">
            <div className="text-xs text-[#858585]">
              {ext.downloadCount !== undefined && (
                <span>{formatDownloadCount(ext.downloadCount)} downloads</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {ext.path && (
                <button
                  onClick={() => {
                    addNotification({ type: 'info', title: 'Extension Location', message: ext.path || '' });
                  }}
                  className="btn flex items-center gap-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  Show Location
                </button>
              )}
              {!installed ? (
                <button
                  onClick={() => {
                    installExtension(ext);
                    setSelectedExtension(null);
                  }}
                  disabled={installingId === ext.id}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {installingId === ext.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Install Extension
                </button>
              ) : (
                <button
                  onClick={() => {
                    uninstallExtension(ext);
                    setSelectedExtension(null);
                  }}
                  disabled={uninstallingId === ext.id}
                  className="btn bg-[#F48771]/20 text-[#F48771] hover:bg-[#F48771]/30 flex items-center gap-2"
                >
                  {uninstallingId === ext.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Uninstall
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[#1E1E1E]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#3E3E42]">
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-5 w-5 text-[#007ACC]" />
          <span className="font-medium">Extensions</span>
        </div>

        {/* Install by ID */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={extensionIdInput}
            onChange={(e) => setExtensionIdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && installById()}
            placeholder="Install by ID (e.g., ms-python.python)"
            className="input flex-1 text-sm"
          />
          <button
            onClick={installById}
            disabled={!extensionIdInput.trim() || installingId === extensionIdInput}
            className="btn btn-primary px-3"
          >
            {installingId === extensionIdInput ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#252526] rounded-lg p-1">
          <button
            onClick={() => setActiveTab('vscode')}
            className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              activeTab === 'vscode' ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-white'
            }`}
          >
            From VSCode ({vscodeExtensions.length})
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              activeTab === 'installed' ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-white'
            }`}
          >
            Installed ({installedExtensions.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
              activeTab === 'search' ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-white'
            }`}
          >
            Search Open-VSX
          </button>
        </div>
      </div>

      {/* Search bar for search tab */}
      {activeTab === 'search' && (
        <div className="px-4 py-2 border-b border-[#3E3E42]">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchExtensions()}
              placeholder="Search extensions..."
              className="input flex-1 text-sm"
            />
            <button
              onClick={searchExtensions}
              disabled={isLoading || !searchQuery.trim()}
              className="btn btn-primary px-3"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>
          </div>
          <a
            href="https://open-vsx.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#007ACC] hover:underline mt-2 inline-flex items-center gap-1"
          >
            Browse Open-VSX <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Refresh button for vscode tab */}
      {activeTab === 'vscode' && (
        <div className="px-4 py-2 border-b border-[#3E3E42] flex items-center justify-between">
          <span className="text-xs text-[#858585]">
            Extensions from your VSCode installation
          </span>
          <button
            onClick={loadVscodeExtensions}
            disabled={isLoading}
            className="btn btn-sm flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && activeTab !== 'search' ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-[#007ACC]" />
          </div>
        ) : (
          <>
            {activeTab === 'vscode' && renderExtensionList(vscodeExtensions)}
            {activeTab === 'installed' && renderExtensionList(installedExtensions, false)}
            {activeTab === 'search' && (
              searchResults.length === 0 && !isLoading ? (
                <div className="text-center py-8 text-[#858585]">
                  <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Search for extensions on Open-VSX</p>
                  <p className="text-xs mt-1">Type a name and press Enter</p>
                </div>
              ) : (
                renderExtensionList(searchResults)
              )
            )}
          </>
        )}
      </div>

      {/* Extension detail modal */}
      {renderExtensionDetail()}
    </div>
  );
}
