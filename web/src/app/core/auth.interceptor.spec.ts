import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  function login(): void {
    auth.login('demo@payflow.dev', 'secret').subscribe();
    backend.expectOne('/api/auth/login').flush({ accessToken: 'token-123' });
  }

  it('does not send a token with the login request', () => {
    auth.login('demo@payflow.dev', 'secret').subscribe();

    const request = backend.expectOne('/api/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ accessToken: 'token-123' });
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('adds the bearer token to API calls', () => {
    login();

    http.get('/api/payments').subscribe();

    const request = backend.expectOne('/api/payments');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-123');
    request.flush({});
  });

  it('never leaks the token to other origins', () => {
    login();

    http.get('https://example.com/data').subscribe();

    const request = backend.expectOne('https://example.com/data');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('ends the session and goes to the login page on 401', () => {
    login();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    http.get('/api/payments').subscribe({ error: () => undefined });
    backend
      .expectOne('/api/payments')
      .flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
