import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ErrorBanner, Monogram, shared } from '../components/ui';
import { FingerprintMark } from '../components/icons';
import { colors, radius, shadow, spacing } from '../components/design';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Login must fit one phone screen with no scrolling needed to reach
// Try demo. The old layout used the full AppHeader (56px top padding)
// plus a second 76px brand block, so the Sign In and Try demo buttons
// sat below the fold and the screen was a plain View that could not
// scroll at all on a real phone. This screen now has a slim header,
// no duplicate brand block, compact inputs and buttons, and a real
// ScrollView as a fallback. Measured budget at 390px wide: slim
// header about 64px, card about 380px, total under 480px, so Try demo
// is in view on load at 844px and at 700px tall, with or without an
// error banner showing.
export default function LoginScreen({ onDemoSignIn }: { onDemoSignIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  async function signIn() {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Sign in is not set up yet. Use Try demo, or ask for the live database to be connected.');
      return;
    }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) setError('Wrong email or password. If this is your first time, ask the Head of Department to create your account.');
    } catch {
      setError('Sign in is not set up yet. Use Try demo, or ask for the live database to be connected.');
    }
    setBusy(false);
  }

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={local.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={local.slimHeader}>
        <Monogram size={34} fontSize={12} />
        <View style={local.slimHeaderText}>
          <Text style={local.slimTitle}>Lahore Garrison University</Text>
          <Text style={local.slimSub}>Examination Department</Text>
        </View>
      </View>
      <View style={local.goldRule} />
      <View style={local.content}>
        <View style={shared.card}>
          <View style={{ alignItems: 'center', marginBottom: 2 }}>
            <FingerprintMark size={28} color={colors.emerald} />
          </View>
          <Text style={shared.sectionLabel}>Staff sign in</Text>
          <Text style={local.heading}>
            Sign in with your department account
          </Text>
          <Text style={local.fieldLabel}>Email</Text>
          <TextInput
            style={[shared.input, local.compactInput, focused === 'email' && shared.inputFocused]}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
          />
          <Text style={local.fieldLabel}>Password</Text>
          <TextInput
            style={[shared.input, local.compactInput, focused === 'password' && shared.inputFocused]}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
          />
          <TouchableOpacity
            testID="sign-in-button"
            style={[shared.button, local.compactButton, busy && shared.buttonDisabled]}
            onPress={signIn}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={shared.buttonText}>Sign In</Text>}
          </TouchableOpacity>
          {error ? <ErrorBanner text={error} /> : null}
          <View style={local.demoDivider}>
            <View style={local.demoLine} />
            <Text style={local.demoDividerText}>or</Text>
            <View style={local.demoLine} />
          </View>
          <TouchableOpacity
            testID="try-demo-button"
            style={[shared.secondaryButton, local.compactButton]}
            onPress={onDemoSignIn}
            activeOpacity={0.7}
          >
            <Text style={shared.secondaryButtonText}>Try demo, no account needed</Text>
          </TouchableOpacity>
          <Text style={local.demoNote}>
            Demo opens as Ahmed Khan. Data stays on this phone.
          </Text>
        </View>
        <Text style={local.securityNote}>
          One account per employee. Never share your password.
        </Text>
      </View>
    </ScrollView>
  );
}

const local = {
  scrollContent: { flexGrow: 1 },
  slimHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.deepGreen,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: 10,
  },
  slimHeaderText: { flex: 1, marginLeft: spacing.sm },
  slimTitle: { color: colors.white, fontSize: 15, fontWeight: '800' as const, lineHeight: 19 },
  slimSub: { color: '#CDE6D5', fontSize: 12, fontWeight: '600' as const, marginTop: 1 },
  goldRule: { height: 3, backgroundColor: colors.gold },
  content: { padding: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  heading: { fontSize: 17, fontWeight: '800' as const, color: colors.ink, lineHeight: 22, marginBottom: spacing.sm },
  fieldLabel: { fontSize: 13, fontWeight: '700' as const, color: colors.ink, marginBottom: 5, marginTop: 2 },
  compactInput: { paddingVertical: 10, fontSize: 15, marginBottom: 6 },
  compactButton: { paddingVertical: 11, marginTop: 6 },
  demoDivider: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: spacing.sm, marginBottom: 2 },
  demoLine: { flex: 1, height: 1, backgroundColor: colors.sageBorder },
  demoDividerText: { color: colors.muted, fontSize: 13, fontWeight: '700' as const, marginHorizontal: spacing.sm },
  demoNote: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center' as const, marginTop: spacing.sm },
  securityNote: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center' as const, paddingHorizontal: spacing.md },
};
