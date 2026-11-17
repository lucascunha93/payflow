import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

const STORAGE_KEY = 'payflow.accessToken';

interface LoginResponse {
  accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  // sessionStorage keeps the session across reloads but not across tabs or restarts.
  private readonly tokenState = signal<string | null>(sessionStorage.getItem(STORAGE_KEY));

  readonly token = this.tokenState.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenState() !== null);

  login(email: string, password: string): Observable<void> {
    return this.http.post<LoginResponse>('/api/auth/login', { email, password }).pipe(
      tap(({ accessToken }) => {
        sessionStorage.setItem(STORAGE_KEY, accessToken);
        this.tokenState.set(accessToken);
      }),
      map(() => undefined),
    );
  }

  logout(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this.tokenState.set(null);
  }
}
