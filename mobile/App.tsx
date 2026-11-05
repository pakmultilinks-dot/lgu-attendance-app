import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { supabase, type Employee } from './src/lib/supabase';
import { DEMO_EMPLOYEE, isDemoSessionActive, setDemoSessionActive } from './src/lib/demo';
import LoginScreen from './src/screens/Login';
import HomeScreen from './src/screens/Home';
import HistoryScreen from './src/screens/History';
import LeaveApplyScreen from './src/screens/LeaveApply';
import LeavesScreen from './src/screens/Leaves';
import { shared } from './src/components/ui';
import { Icon, type IconName } from './src/components/icons';
import { colors } from './src/components/design';

type ScreenView = 'home' | 'leave-apply' | 'leaves' | 'history';

const TABS: { view: ScreenView; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Today', icon: 'home' },
  { view: 'history', label: 'History', icon: 'clock' },
  { view: 'leave-apply', label: 'Apply Leave', icon: 'leave' },
  { view: 'leaves', label: 'My Leaves', icon: 'calendar' },
];

function TabBar({ view, onNavigate }: { view: ScreenView; onNavigate: (v: ScreenView) => void }) {
  return (
    <View style={tabStyles.bar}>
      {TABS.map((tab) => {
        const active = view === tab.view;
        return (
          <TouchableOpacity key={tab.view} style={tabStyles.tab} onPress={() => onNavigate(tab.view)} activeOpacity={0.7}>
            <Icon name={tab.icon} size={21} color={active ? colors.deepGreen : colors.faint} />
            <Text style={[tabStyles.label, active && tabStyles.labelActive]}>{tab.label}</Text>
            {active ? <View style={tabStyles.activeDot} /> : <View style={tabStyles.inactiveDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabStyles = {
  bar: {
    flexDirection: 'row' as const,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.sageBorder,
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 6,
    shadowColor: '#064E2B',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 6,
  },
  tab: { flex: 1, alignItems: 'center' as const, paddingVertical: 2 },
  label: { fontSize: 11, fontWeight: '700' as const, color: colors.faint, marginTop: 3 },
  labelActive: { color: colors.deepGreen },
  activeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.gold, marginTop: 4 },
  inactiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent', marginTop: 4 },
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [view, setView] = useState<ScreenView>('home');
  const isDemoRef = useRef(false);

  async function enterDemo() {
    isDemoRef.current = true;
    setIsDemo(true);
    setEmployee(DEMO_EMPLOYEE);
    setView('home');
    await setDemoSessionActive(true);
  }

  async function exitDemo() {
    isDemoRef.current = false;
    setIsDemo(false);
    setEmployee(null);
    await setDemoSessionActive(false);
  }

  async function loadEmployee(userId: string) {
    try {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();
      setEmployee((data as Employee | null) ?? null);
    } catch {
      setEmployee(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await isDemoSessionActive()) {
        if (!cancelled) {
          isDemoRef.current = true;
          setIsDemo(true);
          setEmployee(DEMO_EMPLOYEE);
          setLoading(false);
        }
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled && data.session?.user) await loadEmployee(data.session.user.id);
      } catch {
        // No live database configured yet. The login screen explains this
        // and offers Try demo instead of crashing here.
      }
      if (!cancelled) setLoading(false);
    })();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isDemoRef.current) return;
      if (session?.user) await loadEmployee(session.user.id);
      else setEmployee(null);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={[shared.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0B6E3A" />
      </View>
    );
  }

  if (!employee) return <LoginScreen onDemoSignIn={enterDemo} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.mint }}>
      <View style={{ flex: 1 }}>
        {view === 'leave-apply' && <LeaveApplyScreen employee={employee} isDemo={isDemo} onDone={() => setView('home')} />}
        {view === 'leaves' && <LeavesScreen employee={employee} isDemo={isDemo} onBack={() => setView('home')} />}
        {view === 'history' && <HistoryScreen employee={employee} isDemo={isDemo} />}
        {view === 'home' && (
          <HomeScreen
            employee={employee}
            isDemo={isDemo}
            onSignOut={() => { void exitDemo(); }}
            onApplyLeave={() => setView('leave-apply')}
            onViewLeaves={() => setView('leaves')}
            onViewHistory={() => setView('history')}
          />
        )}
      </View>
      <TabBar view={view} onNavigate={setView} />
    </View>
  );
}
