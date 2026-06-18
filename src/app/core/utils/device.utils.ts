import { PushTokenStatus } from '../models/api.models';

/**
 * PrimeNG tag severity for a device's push-token status. Shared by the devices
 * list and the device detail page so the colour mapping stays in one place.
 */
export function pushTokenStatusSeverity(
  status: PushTokenStatus,
): 'success' | 'warn' | 'danger' | 'secondary' {
  switch (status) {
    case 'active':
      return 'success';
    case 'invalid':
      return 'warn';
    case 'revoked':
      return 'danger';
    default:
      return 'secondary';
  }
}
