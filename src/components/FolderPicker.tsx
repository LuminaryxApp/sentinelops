import { open } from '@tauri-apps/plugin-dialog';

export interface FolderPickerOptions {
  title?: string;
  defaultPath?: string | null;
  allowedFolder?: string; // Restrict selection to this folder (validates after selection)
}

/**
 * Opens the native folder picker dialog and returns the selected path.
 * Returns null if user cancelled or an error occurred.
 */
export async function openFolderPicker(options: FolderPickerOptions = {}): Promise<string | null> {
  const { title = 'Select Folder', defaultPath, allowedFolder } = options;

  console.log('Opening folder picker with options:', { title, defaultPath, allowedFolder });

  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: title,
      defaultPath: defaultPath || undefined,
    });

    console.log('Folder picker result:', selected);

    if (selected && typeof selected === 'string') {
      // If there's an allowed folder restriction, validate the selection
      if (allowedFolder) {
        // Normalize paths for comparison (handle Windows backslashes)
        const normalizedSelected = selected.replace(/\\/g, '/').toLowerCase();
        const normalizedAllowed = allowedFolder.replace(/\\/g, '/').toLowerCase();

        if (!normalizedSelected.startsWith(normalizedAllowed)) {
          // Selection is outside allowed folder
          console.warn('Selected folder is outside allowed folder:', { selected, allowedFolder });
          alert(`Selected folder must be within: ${allowedFolder}`);
          return null;
        }
      }

      return selected;
    }

    console.log('User cancelled folder selection');
    return null;
  } catch (error) {
    console.error('Failed to open folder dialog:', error);
    // Show a more helpful error message
    alert(`Failed to open folder picker: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// Default export for backwards compatibility
export default function FolderPicker() {
  return null;
}
