import { Platform } from 'react-native';

// Android emulators reach the host machine at 10.0.2.2. On a real phone set
// EXPO_PUBLIC_API_URL to your computer's LAN address, e.g. http://192.168.1.5:4000.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');

export type Loan = {
  id: number;
  friendName: string;
  amount: number;
  dueDate: string;
  repaidAt: string | null;
  overdue: boolean;
  hasReceipt: boolean;
};

export type Summary = { totalLent: number; totalRepaid: number; overdueAmount: number };

export type NewLoan = {
  friendName: string;
  amount: number;
  dueDate: string;
  receipt?: { base64: string; mimeType: string };
};

async function request<T>(path: string, options: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const res = await fetch(API_URL + path, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }).catch(() => {
    throw new Error(`Cannot reach the server at ${API_URL}`);
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  requestOtp: (phone: string) => request<{ message: string }>('/auth/request-otp', { method: 'POST', body: { phone } }),
  verifyOtp: (phone: string, otp: string) =>
    request<{ token: string }>('/auth/verify-otp', { method: 'POST', body: { phone, otp } }),
  loans: (token: string) => request<Loan[]>('/loans', { token }),
  summary: (token: string) => request<Summary>('/summary', { token }),
  addLoan: (token: string, loan: NewLoan) => request<Loan>('/loans', { method: 'POST', body: loan, token }),
  repay: (token: string, id: number) => request<Loan>(`/loans/${id}/repay`, { method: 'POST', token }),
  receiptUrl: (id: number) => `${API_URL}/loans/${id}/receipt`,
};
