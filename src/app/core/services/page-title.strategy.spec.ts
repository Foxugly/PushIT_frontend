import { Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { RouterStateSnapshot } from '@angular/router';
import { signal } from '@angular/core';

import { AppCopyService } from './app-copy.service';
import { PageTitleStrategy, resolveTitleKey } from './page-title.strategy';

describe('resolveTitleKey', () => {
  const copy = { header: { features: 'Fonctionnalités' }, list: [{ label: 'Applications' }] };

  it('resolves dotted keys, including array indexes', () => {
    expect(resolveTitleKey(copy, 'header.features')).toBe('Fonctionnalités');
    expect(resolveTitleKey(copy, 'list.0.label')).toBe('Applications');
  });

  it('returns null for unknown keys', () => {
    expect(resolveTitleKey(copy, 'header.nope')).toBeNull();
    expect(resolveTitleKey(copy, 'nope.deeper')).toBeNull();
  });
});

describe('PageTitleStrategy', () => {
  const copy = signal<unknown>({ header: { features: 'Fonctionnalités' } });

  function snapshotWith(data: Record<string, unknown>): RouterStateSnapshot {
    return { root: { data: {}, firstChild: { data, firstChild: null } } } as unknown as RouterStateSnapshot;
  }

  function setup() {
    copy.set({ header: { features: 'Fonctionnalités' } });
    TestBed.configureTestingModule({
      providers: [
        PageTitleStrategy,
        { provide: AppCopyService, useValue: { current: copy } },
      ],
    });
    return { strategy: TestBed.inject(PageTitleStrategy), title: TestBed.inject(Title) };
  }

  it('composes the translated page title with the app name', () => {
    const { strategy, title } = setup();
    strategy.updateTitle(snapshotWith({ titleKey: 'header.features' }));
    TestBed.tick();
    expect(title.getTitle()).toBe('Fonctionnalités — PushIT');
  });

  it('falls back to the app name without a titleKey', () => {
    const { strategy, title } = setup();
    strategy.updateTitle(snapshotWith({}));
    TestBed.tick();
    expect(title.getTitle()).toBe('PushIT');
  });

  it('updates when the language (catalog) changes', () => {
    const { strategy, title } = setup();
    strategy.updateTitle(snapshotWith({ titleKey: 'header.features' }));
    TestBed.tick();
    copy.set({ header: { features: 'Features' } });
    TestBed.tick();
    expect(title.getTitle()).toBe('Features — PushIT');
  });
});
