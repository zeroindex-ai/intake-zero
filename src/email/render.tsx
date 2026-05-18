import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

export function renderEmail(element: ReactElement): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${renderToStaticMarkup(element)}</body></html>`;
}
