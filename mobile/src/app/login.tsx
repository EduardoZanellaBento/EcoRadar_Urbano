import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mensagemDeErro } from '@/api/cliente';
import { autenticacao } from '@/api/servicos';
import { CampoSenha } from '@/componentes/CampoSenha';
import { Logo } from '@/componentes/Logo';
import { useSessao } from '@/estado/sessao';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const tema = useTheme();
  const entrar = useSessao((s) => s.entrar);
  const motivoSaida = useSessao((s) => s.motivoSaida);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const emailInvalido = tocado && !EMAIL_VALIDO.test(email.trim());
  const senhaVazia = tocado && senha.length === 0;

  const enviar = async () => {
    setTocado(true);
    setErro(null);
    if (!EMAIL_VALIDO.test(email.trim()) || !senha) return;
    setCarregando(true);
    try {
      entrar(await autenticacao.login(email.trim(), senha));
      router.replace('/(abas)');
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={estilos.pagina} keyboardShouldPersistTaps="handled">
          <View style={estilos.cabecalho}>
            <Logo tamanho={88} comFundo />
            <Text variant="headlineMedium" style={{ fontWeight: '800' }}>
              EcoRadar Urbano
            </Text>
            <Text variant="bodyMedium" style={{ color: tema.colors.onSurfaceVariant, textAlign: 'center' }}>
              Informações ambientais da cidade, em tempo real e de forma colaborativa.
            </Text>
          </View>

          <Surface style={estilos.cartao} elevation={1}>
            <Text variant="titleLarge" style={{ fontWeight: '700' }}>
              Entrar
            </Text>
            {motivoSaida && !erro && (
              <HelperText type="info" visible>
                {motivoSaida}
              </HelperText>
            )}
            <TextInput
              mode="outlined"
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              left={<TextInput.Icon icon="email-outline" />}
              error={emailInvalido}
              testID="campo-email"
              accessibilityLabel="E-mail"
            />
            {emailInvalido && <HelperText type="error">Informe um e-mail válido.</HelperText>}
            <CampoSenha
              label="Senha"
              value={senha}
              onChangeText={setSenha}
              onSubmitEditing={enviar}
              left={<TextInput.Icon icon="lock-outline" />}
              error={senhaVazia}
              testID="campo-senha"
              accessibilityLabel="Senha"
            />
            {senhaVazia && <HelperText type="error">Informe a senha.</HelperText>}
            {erro && (
              <HelperText type="error" visible testID="erro-login" style={{ fontSize: 14 }}>
                {erro}
              </HelperText>
            )}
            <Button mode="contained" onPress={enviar} loading={carregando} disabled={carregando} contentStyle={{ paddingVertical: 6 }} testID="botao-entrar">
              Entrar
            </Button>
            <View style={estilos.rodape}>
              <Text variant="bodyMedium">Ainda não tem conta?</Text>
              <Link href="/cadastro" asChild>
                <Button mode="text" compact testID="link-cadastro">
                  Criar conta
                </Button>
              </Link>
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pagina: { flexGrow: 1, justifyContent: 'center', padding: 20, gap: 24, maxWidth: 520, width: '100%', alignSelf: 'center' },
  cabecalho: { alignItems: 'center', gap: 8 },
  cartao: { padding: 20, borderRadius: 20, gap: 10 },
  rodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
});
