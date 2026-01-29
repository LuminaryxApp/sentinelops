import { useEffect, useState } from 'react';
import { Trash2, RefreshCw, RotateCcw, XCircle, File, Folder, Calendar, AlertTriangle } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { api, TrashItem } from '../services/api';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TrashPanel() {
  const { trashItems, isLoadingTrash, setTrashItems, setLoadingTrash, addNotification } = useStore();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const loadTrash = async () => {
    setLoadingTrash(true);
    try {
      const response = await api.trashList();
      if (response.ok && response.data) {
        setTrashItems(response.data.items);
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to load trash',
          message: response.error?.message || 'Unknown error',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to load trash',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoadingTrash(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const restoreItem = async (item: TrashItem) => {
    setIsRestoring(true);
    try {
      const response = await api.trashRestore(item.trashId);
      if (response.ok) {
        addNotification({
          type: 'success',
          title: 'Item restored',
          message: item.originalPath,
        });
        loadTrash();
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to restore',
          message: response.error?.message || 'Unknown error',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to restore',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const purgeItem = async (item: TrashItem) => {
    if (!confirm(`Permanently delete "${item.originalPath}"? This cannot be undone!`)) return;

    setIsPurging(true);
    try {
      const response = await api.trashPurge({ trashId: item.trashId });
      if (response.ok) {
        addNotification({ type: 'success', title: 'Item permanently deleted', message: '' });
        loadTrash();
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to purge',
          message: response.error?.message || 'Unknown error',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to purge',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsPurging(false);
    }
  };

  const emptyTrash = async () => {
    if (!confirm('Permanently delete all items in trash? This cannot be undone!')) return;

    setIsPurging(true);
    try {
      const response = await api.trashPurge({});
      if (response.ok) {
        addNotification({ type: 'success', title: 'Trash emptied', message: '' });
        setTrashItems([]);
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to empty trash',
          message: response.error?.message || 'Unknown error',
        });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to empty trash',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsPurging(false);
    }
  };

  // Group items by date
  const groupedItems = trashItems.reduce(
    (acc, item) => {
      const date = item.deletedAt.split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(item);
      return acc;
    },
    {} as Record<string, TrashItem[]>
  );

  return (
    <div className="flex h-full flex-col bg-[#1E1E1E]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#3E3E42]">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-[#D4D4D4]" />
          <span className="font-medium">Trash</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTrash}
            disabled={isLoadingTrash}
            className="p-1.5 hover:bg-[#3E3E42] rounded"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingTrash ? 'animate-spin' : ''}`} />
          </button>
          {trashItems.length > 0 && (
            <button
              onClick={emptyTrash}
              disabled={isPurging}
              className="btn btn-danger text-xs"
            >
              Empty Trash
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-2 text-sm text-[#858585] border-b border-[#3E3E42]">
        {trashItems.length === 0
          ? 'Trash is empty'
          : `${trashItems.length} item${trashItems.length === 1 ? '' : 's'} in trash`}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingTrash ? (
          <div className="flex h-48 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-[#007ACC]" />
          </div>
        ) : trashItems.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[#858585]">
            <div className="text-center">
              <Trash2 className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Trash is empty</p>
            </div>
          </div>
        ) : (
          <div>
            {Object.entries(groupedItems)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, items]) => (
                <div key={date} className="border-b border-[#3E3E42]">
                  <div className="px-4 py-2 flex items-center gap-2 text-xs text-[#858585]">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {new Date(date).toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  {items.map((item) => (
                    <div
                      key={item.trashId}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#2A2D2E] group"
                    >
                      {item.type === 'directory' ? (
                        <Folder className="h-5 w-5 text-[#DCB67A]" />
                      ) : (
                        <File className="h-5 w-5 text-[#D4D4D4]" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.originalPath}</p>
                        <div className="flex items-center gap-3 text-xs text-[#858585]">
                          <span>{formatSize(item.size)}</span>
                          <span>{formatDate(item.deletedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => restoreItem(item)}
                          disabled={isRestoring}
                          className="p-1.5 hover:bg-[#3E3E42] rounded"
                          title="Restore"
                        >
                          <RotateCcw className="h-4 w-4 text-[#007ACC]" />
                        </button>
                        <button
                          onClick={() => purgeItem(item)}
                          disabled={isPurging}
                          className="p-1.5 hover:bg-[#3E3E42] rounded"
                          title="Delete permanently"
                        >
                          <XCircle className="h-4 w-4 text-[#F48771]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Warning */}
      {trashItems.length > 0 && (
        <div className="px-4 py-3 border-t border-[#3E3E42]">
          <div className="flex items-start gap-2 text-xs text-[#CCA700]">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <p>
              Items in trash are kept for 30 days before automatic cleanup. Permanently deleted items
              cannot be recovered.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
