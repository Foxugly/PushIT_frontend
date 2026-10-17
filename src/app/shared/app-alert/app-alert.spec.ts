import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppAlert } from './app-alert';

describe('AppAlert', () => {
  let fixture: ComponentFixture<AppAlert>;

  function create(inputs: Record<string, unknown>): void {
    fixture = TestBed.createComponent(AppAlert);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [AppAlert] });
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('keeps a danger alert on screen: it never disappears on its own', async () => {
    create({ message: 'Erreur', tone: 'danger' });
    await vi.advanceTimersByTimeAsync(60_000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.app-alert--danger')).not.toBeNull();
  });

  it('dismisses a success alert after the default timeout', async () => {
    const dismissed = vi.fn();
    create({ message: 'Enregistré', tone: 'success' });
    fixture.componentInstance.dismissed.subscribe(dismissed);

    await vi.advanceTimersByTimeAsync(5_000 + 200);

    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('still honours an explicit timeout on a danger alert', async () => {
    const dismissed = vi.fn();
    create({ message: 'Erreur', tone: 'danger', timeoutMs: 1_000 });
    fixture.componentInstance.dismissed.subscribe(dismissed);

    await vi.advanceTimersByTimeAsync(1_000 + 200);

    expect(dismissed).toHaveBeenCalledTimes(1);
  });
});
