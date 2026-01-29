import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
}

export interface UpdateProgress {
  downloaded: number;
  total: number;
  percent: number;
}

class UpdateService {
  private update: Update | null = null;
  private progressCallback: ((progress: UpdateProgress) => void) | null = null;

  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      const update = await check();

      if (update) {
        this.update = update;
        return {
          version: update.version,
          currentVersion: update.currentVersion,
          date: update.date,
          body: update.body,
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      throw error;
    }
  }

  onProgress(callback: (progress: UpdateProgress) => void) {
    this.progressCallback = callback;
  }

  async downloadAndInstall(): Promise<void> {
    if (!this.update) {
      throw new Error('No update available');
    }

    try {
      let downloaded = 0;
      let total = 0;

      await this.update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength || 0;
            if (this.progressCallback) {
              this.progressCallback({ downloaded: 0, total, percent: 0 });
            }
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (this.progressCallback && total > 0) {
              this.progressCallback({
                downloaded,
                total,
                percent: Math.round((downloaded / total) * 100),
              });
            }
            break;
          case 'Finished':
            if (this.progressCallback) {
              this.progressCallback({ downloaded: total, total, percent: 100 });
            }
            break;
        }
      });

      // Relaunch the app after update
      await relaunch();
    } catch (error) {
      console.error('Failed to download and install update:', error);
      throw error;
    }
  }
}

export const updateService = new UpdateService();
export default updateService;
