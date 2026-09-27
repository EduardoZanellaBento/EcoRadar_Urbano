import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Banner, Button, Card, Snackbar, Text, useTheme } from 'react-native-paper';
import { mensagemDeErro } from '@/api/cliente';
import { useConfirmarOcorrencia, useDetalheOcorrencia } from '@/api/consultas';
import { DialogoStatus } from '@/componentes/DialogoStatus';
import { Bloco } from '@/componentes/Esqueleto';
import { EstadoVazio } from '@/componentes/EstadoVazio';
import { EtiquetaSeveridade, EtiquetaStatus } from '@/componentes/Etiquetas';
import { Icone } from '@/componentes/Icone';
import Mapa from '@/componentes/mapa/Mapa';
import { urlAbsoluta } from '@/config';
import { temPerfil, useSessao } from '@/estado/sessao';
import { CATEGORIA, SEVERIDADE, STATUS } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import { dataHora, tempoRelativo } from '@/utils/formatacao';

export default function DetalheOcorrencia() {
  const { id, nova } = useLocalSearchParams<{ id: string; nova?: string }>();
  const tema = useTheme<TemaEcoRadar>();
  const usuario = useSessao((s) => s.usuario);
  const consulta = useDetalheOcorrencia(id);
  const confirmar = useConfirmarOcorrencia(id);
  const [dialogo, setDialogo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(nova ? 'Ocorrência registrada com sucesso! Obrigado por colaborar.' : null);

  if (consulta.isLoading) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Bloco altura={200} raio={14} />
        <Bloco largura="60%" altura={22} />
        <Bloco altura={80} />
      </View>
    );
  }
  const o = consulta.data;
  if (!o) {
    return <EstadoVazio ilustracao="erro" titulo="Ocorrência não encontrada" descricao={mensagemDeErro(consulta.error)} acao={{ rotulo: 'Tentar novamente', aoPressionar: () => void consulta.refetch() }} />;
  }
  const cat = CATEGORIA[o.categoria];
  const propria = o.usuarioId === usuario?.id;
  const encerrada = o.status === 'RESOLVIDA' || o.status === 'DESCARTADA';
  const foto = urlAbsoluta(o.fotoUrl);
  const podeAlterar = temPerfil(usuario, 'AGENTE', 'ADMIN');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={estilos.pagina} testID="tela-detalhe">
        {foto && <Image source={{ uri: foto }} style={estilos.foto} contentFit="cover" accessibilityLabel={`Foto da ocorrência de ${cat.rotulo}`} testID="foto-detalhe" />}
        <View style={estilos.linha}>
          <View style={[estilos.icone, { backgroundColor: SEVERIDADE[o.severidade].cor }]}>
            <Icone nome={cat.icone} cor={SEVERIDADE[o.severidade].corTexto} tamanho={26} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
              {cat.rotulo}
            </Text>
            <Text variant="labelMedium" style={{ color: tema.extra.tintaFraca }}>
              {o.bairro ?? 'Local não identificado'} · {tempoRelativo(o.criadoEm)}
            </Text>
          </View>
        </View>
        <View style={estilos.etiquetas}>
          <EtiquetaSeveridade severidade={o.severidade} />
          <EtiquetaStatus status={o.status} />
        </View>
        {o.emAreaDeManancial && (
          <Banner visible icon="water-alert" style={{ borderRadius: 12 }}>
            Dentro da área de proteção do manancial {o.manancialNome}.
          </Banner>
        )}
        <Text variant="bodyLarge">{o.descricao}</Text>

        <Card>
          <Card.Content style={{ gap: 6 }}>
            <Linha icone="account" texto={`Registrada por ${o.usuarioNome}`} />
            <Linha icone="calendar-clock" texto={dataHora(o.criadoEm)} />
            <Linha icone="crosshairs-gps" texto={`${o.latitude.toFixed(5)}, ${o.longitude.toFixed(5)}`} />
            <Linha icone="account-group" texto={`${o.confirmacoes} ${o.confirmacoes === 1 ? 'confirmação' : 'confirmações'} de outros cidadãos`} testID="contador-confirmacoes" />
            {o.resolvidoEm && <Linha icone="check-circle" texto={`Resolvida em ${dataHora(o.resolvidoEm)}`} />}
          </Card.Content>
        </Card>

        <View style={estilos.mapa}>
          <Mapa
            regiaoInicial={{ latitude: o.latitude, longitude: o.longitude, delta: 0.015 }}
            ocorrencias={[{ id: o.id, latitude: o.latitude, longitude: o.longitude, categoria: o.categoria, severidade: o.severidade, titulo: cat.rotulo }]}
            modoEscuro={tema.extra.escuro}
            interativo={false}
          />
        </View>

        {!propria && !encerrada && (
          <Button
            mode={o.confirmadoPorMim ? 'outlined' : 'contained'}
            icon={o.confirmadoPorMim ? 'check-decagram' : 'hand-okay'}
            disabled={o.confirmadoPorMim || confirmar.isPending}
            loading={confirmar.isPending}
            onPress={async () => {
              try {
                await confirmar.mutateAsync();
                setAviso('Obrigado! Sua confirmação ajuda a priorizar o atendimento.');
              } catch (e) {
                setAviso(mensagemDeErro(e));
              }
            }}
            testID="botao-confirmar"
          >
            {o.confirmadoPorMim ? 'Você confirmou esta ocorrência' : 'Confirmar: eu também vi isso'}
          </Button>
        )}
        {propria && (
          <Text variant="bodySmall" style={{ color: tema.extra.tintaFraca, textAlign: 'center' }}>
            Você registrou esta ocorrência — outros cidadãos podem confirmá-la.
          </Text>
        )}
        {podeAlterar && (
          <Button mode="contained-tonal" icon="clipboard-edit" onPress={() => setDialogo(true)} testID="botao-alterar-status">
            Alterar status
          </Button>
        )}

        <Text variant="titleMedium" style={{ marginTop: 8 }}>
          Histórico de status
        </Text>
        <View testID="historico">
          {o.historico.map((h, i) => (
            <View key={h.id} style={estilos.passo}>
              <View style={estilos.trilho}>
                <View style={[estilos.marcador, { backgroundColor: STATUS[h.statusNovo].cor }]}>
                  <Icone nome={STATUS[h.statusNovo].icone} tamanho={14} cor="#ffffff" />
                </View>
                {i < o.historico.length - 1 && <View style={[estilos.linhaTempo, { backgroundColor: tema.colors.outlineVariant }]} />}
              </View>
              <View style={{ flex: 1, paddingBottom: 14 }}>
                <Text variant="labelLarge">
                  {h.statusAnterior ? `${STATUS[h.statusAnterior].rotulo} → ` : ''}
                  {STATUS[h.statusNovo].rotulo}
                </Text>
                <Text variant="bodyMedium">{h.comentario}</Text>
                <Text variant="labelSmall" style={{ color: tema.extra.tintaFraca }}>
                  {h.usuarioNome} · {dataHora(h.criadoEm)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      {podeAlterar && dialogo && (
        <DialogoStatus
          visivel
          ocorrenciaId={o.id}
          statusAtual={o.status}
          aoFechar={() => setDialogo(false)}
          aoConcluir={(s) => setAviso(`Status alterado para ${STATUS[s].rotulo}.`)}
        />
      )}
      <Snackbar visible={Boolean(aviso)} onDismiss={() => setAviso(null)} duration={3500} testID="aviso-detalhe">
        {aviso}
      </Snackbar>
    </View>
  );
}

function Linha({ icone, texto, testID }: { icone: string; texto: string; testID?: string }) {
  const tema = useTheme<TemaEcoRadar>();
  return (
    <View style={estilos.linha} testID={testID}>
      <Icone nome={icone} tamanho={18} cor={tema.extra.tintaFraca} />
      <Text variant="bodyMedium" style={{ flex: 1 }}>
        {texto}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: 16, gap: 12, paddingBottom: 40, maxWidth: 760, width: '100%', alignSelf: 'center' },
  foto: { width: '100%', height: 220, borderRadius: 16 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icone: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  etiquetas: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mapa: { height: 180, borderRadius: 14, overflow: 'hidden' },
  passo: { flexDirection: 'row', gap: 12 },
  trilho: { alignItems: 'center', width: 24 },
  marcador: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  linhaTempo: { width: 2, flex: 1, marginTop: 2 },
});
