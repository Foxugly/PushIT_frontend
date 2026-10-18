import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PushitApiService } from './pushit-api.service';

describe('PushitApiService.deleteMe', () => {
  it('sends DELETE /auth/me/ with the current password in the body', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(PushitApiService);
    const http = TestBed.inject(HttpTestingController);

    let done = false;
    api.deleteMe('hunter2').subscribe(() => (done = true));

    const req = http.expectOne((r) => r.url.endsWith('/auth/me/'));
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ current_password: 'hunter2' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBe(true);
    http.verify();
  });
});
