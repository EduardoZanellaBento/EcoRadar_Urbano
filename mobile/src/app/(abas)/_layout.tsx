import { Redirect, Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { Icone } from '@/componentes/Icone';
import { useAlertasTempoReal } from '@/estado/conexao';
import { useSessao } from '@/estado/sessao';

export default function LayoutAbas() {
  const tema = useTheme();
  const token = useSessao((s) => s.token);
  const naoLidos = useAlertasTempoReal((s) => s.naoLidos);
  if (!token) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tema.colors.primary,
        tabBarInactiveTintColor: tema.colors.onSurfaceVariant,
        tabBarStyle: { backgroundColor: tema.colors.surface, borderTopColor: tema.colors.outlineVariant },
        headerStyle: { backgroundColor: tema.colors.surface },
        headerTintColor: tema.colors.onSurface,
        headerTitleStyle: { fontWeight: '700' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mapa',
          headerShown: false,
          tabBarButtonTestID: 'aba-mapa',
          tabBarIcon: ({ color, size }) => <Icone nome="map-marker-radius" cor={color} tamanho={size} />,
        }}
      />
      <Tabs.Screen
        name="ocorrencias"
        options={{
          title: 'Ocorrências',
          tabBarButtonTestID: 'aba-ocorrencias',
          tabBarIcon: ({ color, size }) => <Icone nome="format-list-bulleted" cor={color} tamanho={size} />,
        }}
      />
      <Tabs.Screen
        name="ambiental"
        options={{
          title: 'Qualidade ambiental',
          tabBarLabel: 'Ambiente',
          tabBarButtonTestID: 'aba-ambiental',
          tabBarIcon: ({ color, size }) => <Icone nome="leaf" cor={color} tamanho={size} />,
        }}
      />
      <Tabs.Screen
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarButtonTestID: 'aba-alertas',
          tabBarBadge: naoLidos > 0 ? naoLidos : undefined,
          tabBarIcon: ({ color, size }) => <Icone nome={naoLidos > 0 ? 'bell-ring' : 'bell'} cor={color} tamanho={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarButtonTestID: 'aba-perfil',
          tabBarIcon: ({ color, size }) => <Icone nome="account-circle" cor={color} tamanho={size} />,
        }}
      />
    </Tabs>
  );
}
