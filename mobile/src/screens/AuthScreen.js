import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Field, Input, ErrorBox } from '../components/ui';
import { colors, radius } from '../theme';

const PACE_OPTIONS = [
  { days: 30, label: 'Intensive', desc: '1 lesson/day' },
  { days: 45, label: 'Steady', desc: '~3 lessons/2 days' },
  { days: 60, label: 'Relaxed', desc: '~1 lesson/2 days' },
  { days: 90, label: 'Casual', desc: '~1 lesson/3 days' },
];

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [planLengthDays, setPlan] = useState(30);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        await register({ email, password, displayName, planLengthDays });
      } else {
        await login(email, password);
      }
      // Navigation happens automatically once `user` is set in context.
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.card}>
          <View style={styles.brand}>
            <View style={styles.dot} />
            <Text style={styles.brandText}>PolePole</Text>
          </View>

          <Text style={styles.title}>
            {mode === 'register' ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text style={styles.sub}>
            {mode === 'register'
              ? 'Set your pace and start learning Swahili today.'
              : 'Log in to continue your Swahili journey.'}
          </Text>

          <ErrorBox>{error}</ErrorBox>

          {mode === 'register' && (
            <Field label="Display name">
              <Input value={displayName} onChangeText={setDisplayName} placeholder="e.g. Amani" />
            </Field>
          )}

          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <Field label="Password">
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              autoCapitalize="none"
            />
          </Field>

          {mode === 'register' && (
            <Field label="Choose your pace (you can change this later)">
              <View style={styles.paceGrid}>
                {PACE_OPTIONS.map((p) => {
                  const active = planLengthDays === p.days;
                  return (
                    <Pressable
                      key={p.days}
                      onPress={() => setPlan(p.days)}
                      style={[styles.paceOpt, active && styles.paceOptActive]}
                    >
                      <Text style={styles.paceNum}>{p.days}</Text>
                      <Text style={styles.paceLabel}>{p.label}</Text>
                      <Text style={styles.paceDesc}>{p.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>
          )}

          <Button
            title={busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}
            onPress={submit}
            disabled={busy}
            block
            style={{ marginTop: 6 }}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === 'register' ? 'Already have an account? ' : 'New here? '}
            </Text>
            <Pressable
              onPress={() => {
                setMode(mode === 'register' ? 'login' : 'register');
                setError('');
              }}
            >
              <Text style={styles.switchLink}>
                {mode === 'register' ? 'Log in' : 'Create an account'}
              </Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: colors.cream,
    padding: 20,
  },
  card: { width: '100%', maxWidth: 460, alignSelf: 'center', padding: 28 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.goldLight },
  brandText: { fontWeight: '800', fontSize: 20, color: colors.navy, letterSpacing: 0.3 },
  title: { fontSize: 26, color: colors.navy, fontWeight: '800', marginBottom: 4 },
  sub: { color: colors.muted, marginBottom: 22, fontSize: 15 },

  paceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paceOpt: {
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    flexGrow: 1,
    flexBasis: '45%',
  },
  paceOptActive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  paceNum: { fontSize: 22, fontWeight: '800', color: colors.navy },
  paceLabel: { fontWeight: '700', color: colors.ink, fontSize: 13.5, marginTop: 2 },
  paceDesc: { fontSize: 12, color: colors.muted, textAlign: 'center' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  switchText: { color: colors.muted, fontSize: 14.5 },
  switchLink: { color: colors.tealDark, fontSize: 14.5, fontWeight: '700' },
});
