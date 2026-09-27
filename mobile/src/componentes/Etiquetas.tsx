import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { CATEGORIA, IQAR, SEVERIDADE, STATUS } from '@/tema/cores';
import type { Categoria, ClasseIqar, Severidade, StatusOcorrencia } from '@/tipos';
import { Icone } from './Icone';

/** Etiqueta de severidade: cor + ícone + texto (nunca só a cor). */
export function EtiquetaSeveridade({ severidade, compacta = false }: { severidade: Severidade; compacta?: boolean }) {
  const s = SEVERIDADE[severidade];
  return (
    <View style={[estilos.etiqueta, { backgroundColor: s.cor }]} accessibilityLabel={`Severidade ${s.rotulo}`}>
      <Icone nome={s.icone} tamanho={13} cor={s.corTexto} />
      <Text style={[estilos.texto, { color: s.corTexto }]}>{compacta ? s.rotulo : `Severidade ${s.rotulo.toLowerCase()}`}</Text>
    </View>
  );
}

export function EtiquetaStatus({ status }: { status: StatusOcorrencia }) {
  const s = STATUS[status];
  return (
    <View style={[estilos.etiqueta, estilos.contorno, { borderColor: s.cor }]} accessibilityLabel={`Status ${s.rotulo}`}>
      <Icone nome={s.icone} tamanho={13} cor={s.cor} />
      <Text style={[estilos.texto, { color: s.cor }]}>{s.rotulo}</Text>
    </View>
  );
}

export function EtiquetaIqar({ classe, indice, grande = false }: { classe: ClasseIqar; indice?: number | null; grande?: boolean }) {
  const c = IQAR[classe];
  return (
    <View
      style={[estilos.etiqueta, { backgroundColor: c.cor }, grande && estilos.grande]}
      accessibilityLabel={`Qualidade do ar ${c.rotulo}${indice != null ? `, índice ${indice}` : ''}`}
    >
      {indice != null && <Text style={[estilos.texto, { color: c.corTexto, fontWeight: '800' }, grande && { fontSize: 18 }]}>{indice}</Text>}
      <Text style={[estilos.texto, { color: c.corTexto }, grande && { fontSize: 15 }]}>{c.rotulo}</Text>
    </View>
  );
}

export function EtiquetaCategoria({ categoria }: { categoria: Categoria }) {
  const c = CATEGORIA[categoria];
  return (
    <View style={estilos.linha} accessibilityLabel={`Categoria ${c.rotulo}`}>
      <Icone nome={c.icone} tamanho={16} />
      <Text variant="labelLarge">{c.rotulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  contorno: { borderWidth: 1.5, backgroundColor: 'transparent' },
  texto: { fontSize: 12, fontWeight: '600' },
  grande: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
