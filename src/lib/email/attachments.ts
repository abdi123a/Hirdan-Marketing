export interface PreparedAttachment {
  filename: string;
  content: string; // base64 (no data: prefix)
  contentType?: string;
  size: number;
}

/** Read a browser File into a base64 attachment payload for the send API. */
export function fileToAttachment(file: File): Promise<PreparedAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      resolve({
        filename: file.name,
        content: base64,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
