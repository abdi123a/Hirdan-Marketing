import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Root directory of the project (parent of 'src' or 'dist')
 */
const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

/**
 * Common storage paths
 */
export const PATHS = {
  PROJECT_ROOT: process.cwd(),
  /**
   * Root directory for all uploads
   */
  UPLOADS_ROOT,
  UPLOADS: UPLOADS_ROOT, // alias for convenience
  
  /**
   * Internal folders within uploads
   */
  DOCUMENTS: path.resolve(UPLOADS_ROOT, 'documents'),
  MEDIA: path.resolve(UPLOADS_ROOT, 'media'),
  BRANDING: path.resolve(UPLOADS_ROOT, 'branding'),
  EMPLOYEE_DOCS: path.resolve(UPLOADS_ROOT, 'employee-docs'),
  RECEIPTS: path.resolve(UPLOADS_ROOT, 'receipts'),
};

/**
 * Helper to ensure a path is relative to public for URL generation
 */
export function getPublicUrl(filename: string): string {
  return `/uploads/${filename}`;
}

/**
 * Helper to generate private API URL for safe serving
 */
export function getPrivateApiUrl(folder: string, filename: string): string {
  return `/uploads/${folder}/${filename}`;
}
