import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';
import { mensagemDeErro } from '@/api/cliente';
import { reiniciarNavegacao } from '@/utils/navegacao';
import { autenticacao } from '@/api/servicos';
import { CampoSenha } from '@/componentes/CampoSenha';
import { useSessao } from '@/estado/sessao';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validar(d: { nome: string; email: string; senha: string; confirmacao: string }) {
  const erros: Partial<Record<keyof typeof d, string>> = {};
  if (d.nome.trim().length < 2) erros.nome = 'Informe seu nome (mínimo de 2 letras).';
  if (!EMAIL_VALIDO.test(d.email.trim())) erros.email = 'Informe um e-mail válido.';
  if (d.senha.length < 8) erros.senha = 'A senha deve ter pelo menos 8 caracteres.';
  else if (!/[A-Za-zÀ-ÿ]/.test(d.senha) || !/\d/.test(d.senha)) erros.senha = 'Use letras e números na senha.';
  if (d.confirmacao !== d.senha) erros.confirmacao = 'As senhas não conferem.';
  return erros;
}

export default function Cadastro() {
  const entrar = useSessao((s) => s.entrar);
  const [dados, setDados] = useState({ nome: '', email: '', senha: '', confirmacao: '', bairro: '' });
  const [tocado, setTocado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const erros = tocado ? validar(dados) : {};
  const campo = (k: keyof typeof dados) => (v: string) => setDados((d) => ({ ...d, [k]: v }));

  const enviar = async () => {
    setTocado(true);
    setErro(null);
    if (Object.keys(validar(dados)).length) return;
    setCarregando(true);
    try {
      const sessao = await autenticacao.registrar({
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        senha: dados.senha,
        bairro: dados.bairro.trim() || undefined,
      });
      entrar(sessao);
      reiniciarNavegacao('/(abas)');
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={estilos.pagina} keyboardShouldPersistTaps="handled">
        <Surface style={estilos.cartao} elevation={1}>
          <Text variant="bodyMedium">Crie sua conta de cidadão para registrar e confirmar ocorrências.</Text>
          <TextInput mode="outlined" label="Nome completo" value={dados.nome} onChangeText={campo('nome')} error={Boolean(erros.nome)} testID="campo-nome" autoComplete="name" />
          {erros.nome && <HelperText type="error">{erros.nome}</HelperText>}
          <TextInput
            mode="outlined"
            label="E-mail"
            value={dados.email}
            onChangeText={campo('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            error={Boolean(erros.email)}
            testID="campo-email-cadastro"
            autoComplete="email"
          />
          {erros.email && <HelperText type="error">{erros.email}</HelperText>}
          <CampoSenha label="Senha (mín. 8, letras e números)" value={dados.senha} onChangeText={campo('senha')} error={Boolean(erros.senha)} testID="campo-senha-cadastro" />
          {erros.senha && <HelperText type="error">{erros.senha}</HelperText>}
          <CampoSenha label="Confirmar senha" value={dados.confirmacao} onChangeText={campo('confirmacao')} error={Boolean(erros.confirmacao)} testID="campo-confirmacao" />
          {erros.confirmacao && <HelperText type="error">{erros.confirmacao}</HelperText>}
          <TextInput mode="outlined" label="Bairro (opcional)" value={dados.bairro} onChangeText={campo('bairro')} testID="campo-bairro" />
          {erro && (
            <HelperText type="error" visible testID="erro-cadastro" style={{ fontSize: 14 }}>
              {erro}
            </HelperText>
          )}
          <Button mode="contained" onPress={enviar} loading={carregando} disabled={carregando} contentStyle={{ paddingVertical: 6 }} testID="botao-cadastrar">
            Criar conta
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pagina: { flexGrow: 1, padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  cartao: { padding: 18, borderRadius: 20, gap: 8 },
});
