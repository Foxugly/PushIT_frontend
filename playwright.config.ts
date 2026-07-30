import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // `list` en local pour la lisibilité ; `html` en plus sur CI, archivé comme
  // artefact par ci.yml (`never` : ne jamais tenter d'ouvrir un navigateur sur
  // le runner).
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],

  // Volontairement PAS de `retries` sur CI. Un retry ferait repasser un test
  // instable au vert et masquerait le problème : le flake magic-link
  // (corrigé le 2026-07-30) est resté invisible des semaines faute de signal.
  // On préfère un échec bruyant, rendu diagnosticable par les artefacts
  // ci-dessous.
  use: {
    baseURL: 'http://127.0.0.1:4200',
    // `on-first-retry` ne produisait JAMAIS rien : sans `retries`, il n'y a
    // jamais de première reprise. `retain-on-failure` capture la trace dès le
    // premier échec, sans exiger de retry.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run e2e:serve',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: true,
    timeout: 90 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
