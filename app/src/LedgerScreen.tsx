import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, type Loan, type NewLoan, type Summary } from './api';
import { colors, money, ui } from './theme';

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function SummaryCard({ summary }: { summary: Summary | null }) {
  const cell = (label: string, value: number | undefined, color: string = colors.text) => (
    <View style={{ flex: 1 }}>
      <Text style={ui.label}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color }}>{value === undefined ? '…' : money(value)}</Text>
    </View>
  );
  return (
    <View style={[ui.card, { flexDirection: 'row', gap: 8 }]}>
      {cell('Total lent', summary?.totalLent)}
      {cell('Repaid', summary?.totalRepaid, colors.success)}
      {cell('Overdue', summary?.overdueAmount, colors.danger)}
    </View>
  );
}

function AddLoanForm({ onAdd }: { onAdd: (loan: NewLoan) => Promise<void> }) {
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(inDays(7));
  const [receipt, setReceipt] = useState<NewLoan['receipt']>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pickReceipt = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.5 });
    const asset = picked.assets?.[0];
    if (!picked.canceled && asset?.base64) setReceipt({ base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const submit = async () => {
    // Quick client-side checks; the server validates again and its message is shown if it disagrees.
    const value = Number(amount);
    if (!friendName.trim()) return setError('Enter a friend name');
    if (!(value > 0)) return setError('Enter an amount greater than 0');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return setError('Due date must be YYYY-MM-DD');
    setBusy(true);
    setError('');
    try {
      await onAdd({ friendName: friendName.trim(), amount: value, dueDate, receipt });
      setFriendName('');
      setAmount('');
      setDueDate(inDays(7));
      setReceipt(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[ui.card, { gap: 10 }]}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Add an entry</Text>
      <TextInput style={ui.input} placeholder="Friend's name" value={friendName} onChangeText={setFriendName} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextInput
          style={[ui.input, { flex: 1 }]}
          placeholder="Amount (₹)"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput style={[ui.input, { flex: 1 }]} placeholder="Due YYYY-MM-DD" value={dueDate} onChangeText={setDueDate} />
      </View>
      <Pressable onPress={pickReceipt}>
        <Text style={ui.link}>{receipt ? 'Receipt attached ✓ (tap to change)' : '+ Attach receipt photo (optional)'}</Text>
      </Pressable>
      {!!error && <Text style={ui.error}>{error}</Text>}
      <Pressable style={ui.button} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={ui.buttonText}>Add</Text>}
      </Pressable>
    </View>
  );
}

function LoanRow({ loan, onRepay }: { loan: Loan; onRepay: () => void }) {
  const repaid = !!loan.repaidAt;
  return (
    <View
      style={[
        ui.card,
        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
        loan.overdue && { borderColor: colors.danger, backgroundColor: colors.dangerBg },
        repaid && { opacity: 0.6 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
          {loan.friendName} {loan.hasReceipt ? '📎' : ''}
        </Text>
        <Text style={{ color: loan.overdue ? colors.danger : colors.muted, marginTop: 2 }}>
          {repaid ? `Repaid ${loan.repaidAt!.slice(0, 10)}` : `${loan.overdue ? 'Overdue · was due' : 'Due'} ${loan.dueDate}`}
        </Text>
      </View>
      <Text style={{ fontSize: 17, fontWeight: '700', color: loan.overdue ? colors.danger : colors.text }}>
        {money(loan.amount)}
      </Text>
      {!repaid && (
        <Pressable onPress={onRepay} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#E8EEFF' }}>
          <Text style={ui.link}>Repaid</Text>
        </Pressable>
      )}
    </View>
  );
}

export function LedgerScreen({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([api.loans(token), api.summary(token)]);
      setLoans(l);
      setSummary(s);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (loan: NewLoan) => {
    await api.addLoan(token, loan);
    await load();
  };

  const repay = async (id: number) => {
    try {
      await api.repay(token, id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <View style={ui.screen}>
      <FlatList
        data={loans}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingTop: 56 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={ui.title}>MiniLedger</Text>
              <Pressable onPress={onLogout}>
                <Text style={ui.link}>Log out</Text>
              </Pressable>
            </View>
            <SummaryCard summary={summary} />
            <AddLoanForm onAdd={add} />
            {!!error && <Text style={ui.error}>{error}</Text>}
            <Text style={[ui.label, { marginTop: 6, marginBottom: 0 }]}>ENTRIES</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? undefined : <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>No entries yet.</Text>
        }
        renderItem={({ item }) => <LoanRow loan={item} onRepay={() => repay(item.id)} />}
      />
    </View>
  );
}
