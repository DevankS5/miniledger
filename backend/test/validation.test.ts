import test from 'node:test';
import assert from 'node:assert/strict';
import { loanSchema, requestOtpSchema, verifyOtpSchema } from '../src/validation';

test('phone numbers are normalised and validated', () => {
  assert.equal(requestOtpSchema.parse({ phone: '+91 98765-43210' }).phone, '+919876543210');
  assert.equal(requestOtpSchema.safeParse({ phone: '12345' }).success, false);
  assert.equal(requestOtpSchema.safeParse({}).success, false);
});

test('OTP must be six digits', () => {
  assert.equal(verifyOtpSchema.safeParse({ phone: '+919876543210', otp: '123456' }).success, true);
  assert.equal(verifyOtpSchema.safeParse({ phone: '+919876543210', otp: '12a456' }).success, false);
});

test('loan entries need a name, a positive 2-decimal amount and a real date', () => {
  const ok = { friendName: '  Rohan ', amount: 1500.5, dueDate: '2026-11-01' };
  assert.equal(loanSchema.parse(ok).friendName, 'Rohan');
  assert.equal(loanSchema.safeParse({ ...ok, friendName: '   ' }).success, false);
  assert.equal(loanSchema.safeParse({ ...ok, amount: 0 }).success, false);
  assert.equal(loanSchema.safeParse({ ...ok, amount: 10.555 }).success, false);
  assert.equal(loanSchema.safeParse({ ...ok, amount: '100' }).success, false);
  assert.equal(loanSchema.safeParse({ ...ok, dueDate: '2026-02-30' }).success, false);
  assert.equal(loanSchema.safeParse({ ...ok, dueDate: '01/11/2026' }).success, false);
  assert.equal(loanSchema.safeParse({ ...ok, receipt: { base64: 'aGk=', mimeType: 'application/pdf' } }).success, false);
});
