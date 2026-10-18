import { allowedBillingRedirect } from './billing-redirect.utils';

describe('allowedBillingRedirect', () => {
  it.each([
    'https://checkout.stripe.com/c/pay/cs_test_123#fid=abc',
    'https://billing.stripe.com/p/session/test_456',
    'https://billing.foxugly.com/return',
    'https://billing-api.foxugly.com/portal/xyz',
  ])('accepts %s', (url) => {
    expect(allowedBillingRedirect(url)).toBe(url);
  });

  it.each([
    'http://checkout.stripe.com/c/pay/cs_test_123',
    'https://checkout.stripe.com.evil.example/c/pay',
    'https://evil.example/?next=https://checkout.stripe.com',
    'https://user:pw@checkout.stripe.com/c/pay',
    'https://checkout.stripe.com:8443/c/pay',
    'javascript:alert(1)',
    '//checkout.stripe.com/c/pay',
    '/dashboard/billing',
    '',
    null,
    undefined,
    42,
  ])('refuses %s', (url) => {
    expect(allowedBillingRedirect(url)).toBeNull();
  });
});
