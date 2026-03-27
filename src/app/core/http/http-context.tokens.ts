import { HttpContextToken } from '@angular/common/http';

export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
export const RETRY_ON_AUTH_FAILURE = new HttpContextToken<boolean>(() => true);
