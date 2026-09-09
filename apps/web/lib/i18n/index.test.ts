// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { getLocale, t } from './index';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

it('hydrates the English UI on a German browser without text recovery', async () => {
  const Label = () => React.createElement('p', null, t('home.hero.title'));
  const container = document.createElement('div');
  container.innerHTML = renderToString(React.createElement(Label));
  localStorage.setItem('miccheck_locale', 'de');
  vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE');
  const onRecoverableError = vi.fn();
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => { root = hydrateRoot(container, React.createElement(Label), {onRecoverableError}); });
  expect(getLocale()).toBe('en');
  expect(onRecoverableError).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it('keeps German available when the caller supplies an explicit locale', () => {
  expect(t('home.hero.title', undefined, 'de')).not.toBe(t('home.hero.title', undefined, 'en'));
});
