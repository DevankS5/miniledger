import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LedgerScreen } from './src/LedgerScreen';
import { LoginScreen } from './src/LoginScreen';

export default function App() {
  // The session token lives in memory: closing the app logs you out.
  const [token, setToken] = useState<string | null>(null);
  return (
    <>
      <StatusBar style="dark" />
      {token ? <LedgerScreen token={token} onLogout={() => setToken(null)} /> : <LoginScreen onLoggedIn={setToken} />}
    </>
  );
}
