import * as DocumentPicker from 'expo-document-picker';

export interface PreparedAttachment {
  filename: string;
  content: string; // base64 (no data: prefix)
  contentType?: string;
  size: number;
}

/**
 * Attachments travel to the API as base64 inside the JSON send payload, so a
 * single huge file would blow up the request body. Resend caps total message
 * size around 40MB; keep individual files well under that.
 */
const MAX_BYTES = 20 * 1024 * 1024;

async function assetToAttachment(
  asset: DocumentPicker.DocumentPickerAsset
): Promise<PreparedAttachment> {
  const size = asset.size ?? 0;
  if (size > MAX_BYTES) {
    throw new Error(`“${asset.name}” is larger than 20 MB and cannot be attached.`);
  }
  const FileSystem = await import('expo-file-system/legacy');
  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return {
    filename: asset.name || 'attachment',
    content,
    contentType: asset.mimeType || 'application/octet-stream',
    size,
  };
}

/** Open the document picker and read the chosen files into send payloads. */
export async function pickAttachments(multiple = true): Promise<PreparedAttachment[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple,
    copyToCacheDirectory: true,
    type: '*/*',
  });
  if (result.canceled || !result.assets?.length) return [];
  return Promise.all(result.assets.map(assetToAttachment));
}

/** Pick exactly one file, e.g. when replacing an existing attachment. */
export async function pickOneAttachment(): Promise<PreparedAttachment | null> {
  const [first] = await pickAttachments(false);
  return first ?? null;
}

export async function pickImage(): Promise<{ uri: string; name: string; type: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    type: 'image/*',
  });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.name || 'image.jpg',
    type: asset.mimeType || 'image/jpeg',
  };
}
