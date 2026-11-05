import * as LocalAuthentication from 'expo-local-authentication';

// Biometric check. This only asks the phone: is the person holding it the
// device owner? Android and iOS never give an app the fingerprint image or
// template. A "yes" here plus the employee login plus the GPS radius check
// is what stops proxy attendance in v1. See SPEC.md for the honest limits.
export type BiometricResult = {
  ok: boolean;
  message: string;
};

export async function authenticateEmployee(): Promise<BiometricResult> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return { ok: false, message: 'This phone has no fingerprint or face sensor.' };
  }

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) {
    return {
      ok: false,
      message: 'No fingerprint or face is enrolled on this phone. Enrol one in phone Settings, then try again.',
    };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirm it is you to record attendance',
    fallbackLabel: 'Use phone PIN',
    disableDeviceFallback: false,
  });

  if (result.success) {
    return { ok: true, message: 'Verified.' };
  }

  if (result.error === 'user_cancel') {
    return { ok: false, message: 'Cancelled. Tap again when ready.' };
  }

  return { ok: false, message: 'Fingerprint did not match. Try again.' };
}

export async function biometricTypeLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face / Fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }
  return 'Biometric';
}
