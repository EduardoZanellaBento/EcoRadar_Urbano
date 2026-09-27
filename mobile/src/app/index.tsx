import { Redirect } from 'expo-router';
import { usePreferencias } from '@/estado/preferencias';
import { useSessao } from '@/estado/sessao';

/** Rota inicial: onboarding (1º acesso) → login → abas. */
export default function Inicio() {
  const onboardingVisto = usePreferencias((s) => s.onboardingVisto);
  const token = useSessao((s) => s.token);
  if (!onboardingVisto) return <Redirect href="/onboarding" />;
  if (!token) return <Redirect href="/login" />;
  return <Redirect href="/(abas)" />;
}
