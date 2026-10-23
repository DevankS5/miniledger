import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { api } from './api';
import { colors, ui } from './theme';

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = () =>
    run(async () => {
      await api.requestOtp(phone);
      setStep('otp');
      setInfo(`Code sent to ${phone}. (Mock OTP: check the server log.)`);
    });

  const verify = () => run(async () => onLoggedIn((await api.verifyOtp(phone, otp)).token));

  return (
    <View style={[ui.screen, { justifyContent: 'center', padding: 24 }]}>
      <Text style={ui.title}>MiniLedger</Text>
      <Text style={{ color: colors.muted, marginBottom: 28, marginTop: 4 }}>Track money you lent to friends.</Text>

      <View style={[ui.card, { gap: 14 }]}>
        {step === 'phone' ? (
          <>
            <Text style={ui.label}>Phone number</Text>
            <TextInput
              style={ui.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              autoFocus
              onSubmitEditing={sendOtp}
            />
            <Pressable style={ui.button} onPress={sendOtp} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={ui.buttonText}>Send OTP</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ color: colors.muted }}>{info}</Text>
            <Text style={ui.label}>6-digit code</Text>
            <TextInput
              style={[ui.input, { letterSpacing: 6, fontSize: 20 }]}
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              autoFocus
              onSubmitEditing={verify}
            />
            <Pressable style={ui.button} onPress={verify} disabled={busy || otp.length !== 6}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={ui.buttonText}>Verify & log in</Text>}
            </Pressable>
            <Pressable onPress={() => { setStep('phone'); setOtp(''); setInfo(''); }}>
              <Text style={ui.link}>Change number</Text>
            </Pressable>
          </>
        )}
        {!!error && <Text style={ui.error}>{error}</Text>}
      </View>
    </View>
  );
}
