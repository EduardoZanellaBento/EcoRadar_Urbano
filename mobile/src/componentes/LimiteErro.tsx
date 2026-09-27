import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { EstadoVazio } from './EstadoVazio';

interface Estado {
  erro: Error | null;
}

/** ErrorBoundary global: um erro inesperado de renderização não derruba o app inteiro. */
export class LimiteErro extends Component<{ children: ReactNode }, Estado> {
  override state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  override componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Erro não tratado na interface:', erro, info.componentStack);
  }

  override render() {
    if (!this.state.erro) return this.props.children;
    return (
      <ScrollView contentContainerStyle={estilos.pagina}>
        <EstadoVazio
          ilustracao="erro"
          titulo="Algo deu errado"
          descricao="Um erro inesperado aconteceu nesta tela. Seus dados estão seguros — tente novamente."
        />
        <View style={estilos.detalhe}>
          <Text variant="bodySmall" selectable>
            {this.state.erro.message}
          </Text>
        </View>
        <Button mode="contained" onPress={() => this.setState({ erro: null })} accessibilityLabel="Tentar novamente">
          Tentar novamente
        </Button>
      </ScrollView>
    );
  }
}

const estilos = StyleSheet.create({
  pagina: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  detalhe: { padding: 12, borderRadius: 8, backgroundColor: 'rgba(127,127,127,0.12)' },
});
