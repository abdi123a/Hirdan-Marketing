import { format } from 'date-fns';

export interface TemplateContext {
  customer?: string;
  company?: string;
  invoice?: string;
  employee?: string;
}

/**
 * Substitute {{variable}} tokens in a template. {{today}} is always resolved;
 * context values fill {{customer}}/{{company}}/etc. when available. Unknown or
 * empty placeholders are left intact so the user can fill them before sending.
 */
export function applyTemplateVars(text: string, ctx: TemplateContext = {}): string {
  const map: Record<string, string> = {
    today: format(new Date(), 'PPP'),
    customer: ctx.customer ?? '',
    company: ctx.company ?? '',
    invoice: ctx.invoice ?? '',
    employee: ctx.employee ?? '',
  };
  return (text || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) =>
    key in map && map[key] ? map[key] : match
  );
}
