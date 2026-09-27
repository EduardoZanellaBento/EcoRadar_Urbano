import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { CATEGORIA } from '@/tema/cores';
import { CATEGORIAS, type Categoria } from '@/tipos';
import { Icone } from './Icone';

/** Grade de ícones para escolher a categoria da ocorrência. */
export function SeletorCategoria({ valor, aoMudar }: { valor: Categoria | null; aoMudar: (c: Categoria) => void }) {
  const tema = useTheme();
  return (
    <View style={estilos.grade} accessibilityRole="radiogroup" accessibilityLabel="Categoria da ocorrência">
      {CATEGORIAS.map((c) => {
        const ativo = valor === c;
        return (
          <TouchableRipple
            key={c}
            onPress={() => aoMudar(c)}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
            accessibilityLabel={CATEGORIA[c].rotulo}
            testID={`categoria-${c}`}
            style={[
              estilos.item,
              {
                borderColor: ativo ? tema.colors.primary : tema.colors.outlineVariant,
                backgroundColor: ativo ? tema.colors.primaryContainer : tema.colors.surface,
              },
            ]}
            borderless
          >
            <View style={estilos.interno}>
              <Icone nome={CATEGORIA[c].icone} tamanho={26} cor={ativo ? tema.colors.onPrimaryContainer : tema.colors.onSurfaceVariant} />
              <Text variant="labelSmall" numberOfLines={2} style={[estilos.texto, { color: ativo ? tema.colors.onPrimaryContainer : tema.colors.onSurface }]}>
                {CATEGORIA[c].rotulo}
              </Text>
            </View>
          </TouchableRipple>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { width: '31.5%', minHeight: 78, borderRadius: 12, borderWidth: 1.5 },
  interno: { alignItems: 'center', justifyContent: 'center', padding: 8, gap: 4, flex: 1 },
  texto: { textAlign: 'center' },
});
