import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#F4F6FA',
  card: '#FFFFFF',
  text: '#14161A',
  muted: '#6B7280',
  primary: '#2F5BEA',
  border: '#E3E6EC',
  danger: '#C62828',
  dangerBg: '#FDECEC',
  success: '#1B7F4B',
};

export const money = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FAFBFD',
    color: colors.text,
  },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14 },
});
