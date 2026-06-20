/**
 * export-csv.ts — hand a generated CSV to the user, the right way per platform.
 *
 *   web    → trigger a file download via a Blob URL
 *   native → write to the cache dir and open the OS share sheet
 *
 * The native deps are imported lazily so they never touch the web bundle.
 */

import { Platform } from 'react-native';

export async function exportCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export history CSV',
      UTI: 'public.comma-separated-values-text',
    });
  }
}
