import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { CodeExamples } from './code-examples';

describe('CodeExamples', () => {
  let fixture: ComponentFixture<CodeExamples>;
  let component: CodeExamples;

  beforeEach(async () => {
    const consoleCopy = {
      current: signal({
        codeExamples: {
          intro: 'Envoyer depuis votre code.',
          envNotice: 'Le jeton vient de PUSHIT_TOKEN.',
          copy: 'Copier',
          copied: 'Copie',
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [CodeExamples],
      providers: [provideNoopAnimations(), { provide: ConsoleCopyService, useValue: consoleCopy }],
    }).compileComponents();

    fixture = TestBed.createComponent(CodeExamples);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('apiBaseUrl', 'https://pushit-api.foxugly.com/api/v1');
    fixture.detectChanges();
  });

  it('covers the six languages the plan asks for', () => {
    const keys = component.examples().map((example) => example.key);

    expect(keys).toContain('c');
    expect(keys).toContain('cpp');
    expect(keys).toContain('python');
    expect(keys).toContain('java');
    expect(keys).toContain('ruby');
    expect(keys).toContain('go');
  });

  it('reads the token from the environment, never inline', () => {
    // The gesture this avoids: pasting the snippet as-is into a repository.
    for (const example of component.examples()) {
      expect(example.code, `${example.key} must read PUSHIT_TOKEN`).toContain('PUSHIT_TOKEN');
    }
  });

  it('never shows an enrolment code as a send credential', () => {
    // An example that got this wrong would reintroduce the flaw through the
    // documentation: the enrolment code is distributed to every recipient.
    for (const example of component.examples()) {
      expect(example.code, `${example.key} must not carry apk_`).not.toContain('apk_');
    }
  });

  it('targets the send endpoint of the configured API', () => {
    for (const example of component.examples()) {
      expect(example.code).toContain(
        'https://pushit-api.foxugly.com/api/v1/notifications/app/send/',
      );
    }
  });
});
