import { useState, useEffect } from 'react';
import { Grid3X3, Search, Plus, Trash2, Package, Loader2, ExternalLink } from 'lucide-react';
import { api, ExtensionInfo } from '../services/api';
import { useStore } from '../hooks/useStore';

export default function AppsPanel() {
  const { installedApps, addInstalledApp, removeInstalledApp, addNotification } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExtensionInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [installedExtensions, setInstalledExtensions] = useState<ExtensionInfo[]>([]);

  // Load installed extensions on mount
  useEffect(() => {
    loadInstalledExtensions();
  }, []);

  const loadInstalledExtensions = async () => {
    const res = await api.listInstalledExtensions();
    if (res.ok && res.data) {
      setInstalledExtensions(res.data.extensions);
    }
  };

  const searchExtensions = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const res = await api.searchOpenvsx(searchQuery);
    if (res.ok && res.data) {
      setSearchResults(res.data.extensions);
    }
    setIsSearching(false);
  };

  const addAppFromExtension = (ext: ExtensionInfo) => {
    addInstalledApp({
      id: ext.id,
      name: ext.name,
      icon: ext.icon,
      extensionId: ext.id,
      extensionPath: ext.path,
      description: ext.description,
    });
    addNotification({
      type: 'success',
      title: 'App Added',
      message: `${ext.name} has been added to your apps`,
    });
  };

  const isAppInstalled = (extId: string) => {
    return installedApps.some(app => app.id === extId);
  };

  const filteredExtensions = installedExtensions.filter(ext =>
    !isAppInstalled(ext.id) &&
    (ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     ext.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-full flex-col bg-[#1E1E1E]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#3E3E42]">
        <div className="flex items-center gap-2 mb-3">
          <Grid3X3 className="h-5 w-5 text-[#007ACC]" />
          <span className="font-medium">Applications</span>
        </div>

        {/* Search installed extensions to add as apps */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchExtensions()}
            placeholder="Search extensions to add..."
            className="input flex-1 text-sm"
          />
          <button
            onClick={searchExtensions}
            disabled={isSearching}
            className="btn btn-primary px-3"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Installed Apps Grid */}
        {installedApps.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#858585] mb-3">Your Apps</h3>
            <div className="grid grid-cols-3 gap-3">
              {installedApps.map((app) => (
                <div
                  key={app.id}
                  className="relative group bg-[#252526] rounded-lg p-3 border border-[#3E3E42] hover:border-[#007ACC] transition-colors cursor-pointer"
                >
                  <button
                    onClick={() => removeInstalledApp(app.id)}
                    className="absolute top-1 right-1 p-1 bg-[#F48771]/20 text-[#F48771] rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#F48771]/30"
                    title="Remove app"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-lg bg-[#3C3C3C] flex items-center justify-center mb-2 overflow-hidden">
                      {app.icon ? (
                        <img src={app.icon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-[#858585]" />
                      )}
                    </div>
                    <span className="text-xs font-medium truncate w-full">{app.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-[#858585] mb-3">Search Results</h3>
            <div className="space-y-2">
              {searchResults.map((ext) => (
                <div
                  key={ext.id}
                  className="flex items-center gap-3 p-2 bg-[#252526] rounded-lg border border-[#3E3E42]"
                >
                  <div className="w-10 h-10 rounded bg-[#3C3C3C] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {ext.icon ? (
                      <img src={ext.icon} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-[#858585]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{ext.name}</div>
                    <div className="text-xs text-[#858585] truncate">{ext.publisher}</div>
                  </div>
                  {isAppInstalled(ext.id) ? (
                    <span className="text-xs text-[#89D185]">Added</span>
                  ) : (
                    <button
                      onClick={() => addAppFromExtension(ext)}
                      className="btn btn-sm btn-primary flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available from installed extensions */}
        {filteredExtensions.length > 0 && !searchResults.length && (
          <div>
            <h3 className="text-sm font-medium text-[#858585] mb-3">Available from Installed Extensions</h3>
            <div className="space-y-2">
              {filteredExtensions.map((ext) => (
                <div
                  key={ext.id}
                  className="flex items-center gap-3 p-2 bg-[#252526] rounded-lg border border-[#3E3E42]"
                >
                  <div className="w-10 h-10 rounded bg-[#3C3C3C] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {ext.icon ? (
                      <img src={ext.icon} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-[#858585]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{ext.name}</div>
                    <div className="text-xs text-[#858585] truncate">{ext.description}</div>
                  </div>
                  <button
                    onClick={() => addAppFromExtension(ext)}
                    className="btn btn-sm flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {installedApps.length === 0 && filteredExtensions.length === 0 && searchResults.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[#858585]">
            <Grid3X3 className="h-16 w-16 mb-4 opacity-50" />
            <p className="text-sm font-medium mb-2">No apps yet</p>
            <p className="text-xs text-center max-w-[200px]">
              Search for extensions or install some from the Extensions panel to add them here
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#3E3E42] text-xs text-[#858585]">
        <a
          href="https://open-vsx.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#007ACC] hover:underline inline-flex items-center gap-1"
        >
          Browse Open-VSX <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
