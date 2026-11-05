import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppHeader, ErrorBanner, Monogram, shared } from '../components/ui';
import { FingerprintMark, Icon } from '../components/icons';
import { colors, radius, shadow, spacing } from '../components/design';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
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
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    if (authError) setError('Wrong email or password. If this is your first time, ask the Head of Department to create your account.');
  }

  return (
    <View style={shared.screen}>
      <AppHeader />
      <View style={shared.content}>
        <View style={local.brandBlock}>
          <Monogram size={76} fontSize={22} />
          <Text style={local.brandName}>Lahore Garrison University</Text>
          <Text style={local.brandSub}>Examination Department</Text>
          <View style={local.brandRule} />
        </View>
        <View style={shared.card}>
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <FingerprintMark size={44} color={colors.emerald} />
          </View>
          <Text style={shared.sectionLabel}>Staff sign in</Text>
          <Text style={local.heading}>
            Sign in with your department account
          </Text>
          <Text style={local.fieldLabel}>Email</Text>
          <TextInput
            style={[shared.input, focused === 'email' && shared.inputFocused]}
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
            style={[shared.input, focused === 'password' && shared.inputFocused]}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
          />
          <TouchableOpacity style={[shared.button, busy && shared.buttonDisabled]} onPress={signIn} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={shared.buttonText}>Sign In</Text>}
          </TouchableOpacity>
          {error ? <ErrorBanner text={error} /> : null}
        </View>
        <View style={local.securityCard}>
        <View style={local.securityMark}>
          <Icon name="shield" size={15} color="#FFFFFF" />
        </View>
          <Text style={local.securityText}>
            One account per employee. Never share your password. Your fingerprint is checked on this phone at check in.
          </Text>
        </View>
      </View>
    </View>
  );
}

const local = {
  brandBlock: { alignItems: 'center' as const, paddingTop: spacing.lg, paddingBottom: spacing.md },
  brandName: { color: colors.ink, fontSize: 19, fontWeight: '800' as const, marginTop: spacing.sm, textAlign: 'center' as const },
  brandSub: { color: colors.muted, fontSize: 14, fontWeight: '600' as const, marginTop: 3 },
  brandRule: { width: 48, height: 3, backgroundColor: colors.gold, borderRadius: 2, marginTop: spacing.sm },
  heading: { fontSize: 20, fontWeight: '800' as const, color: colors.ink, lineHeight: 26, marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '700' as const, color: colors.ink, marginBottom: 6, marginTop: 2 },
  securityCard: {
    flexDirection: 'row' as const, alignItems: 'flex-start' as const, backgroundColor: colors.sage,
    borderRadius: radius.card, padding: spacing.md, ...shadow.card,
  },
  securityMark: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.emerald,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: spacing.sm,
  },
  securityText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
};
