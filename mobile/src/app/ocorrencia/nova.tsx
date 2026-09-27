import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Banner, Button, HelperText, IconButton, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { mensagemDeErro } from '@/api/cliente';
import { useMananciais } from '@/api/consultas';
import { ocorrencias as apiOcorrencias } from '@/api/servicos';
import { Icone } from '@/componentes/Icone';
import Mapa from '@/componentes/mapa/Mapa';
import { SeletorCategoria } from '@/componentes/SeletorCategoria';
import { CIDADE_PADRAO } from '@/config';
import { useConexao } from '@/estado/conexao';
import type { FotoLocal } from '@/estado/filaOffline';
import { obterLocalizacao } from '@/servicos/localizacao';
import { registrarOcorrencia } from '@/servicos/sincronizacao';
import { SEVERIDADE } from '@/tema/cores';
import type { TemaEcoRadar } from '@/tema/tema';
import { SEVERIDADES, type Categoria, type Severidade } from '@/tipos';
import { manancialLocal } from '@/utils/geo';

const LIMITE_FOTO = 5 * 1024 * 1024;

export default function NovaOcorrencia() {
  const tema = useTheme<TemaEcoRadar>();
  const qc = useQueryClient();
  const online = useConexao((s) => s.online) !== false;
  const mananciais = useMananciais();
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [severidade, setSeveridade] = useState<Severidade>('MEDIA');
  const [descricao, setDescricao] = useState('');
  const [foto, setFoto] = useState<FotoLocal | null>(null);
  const [ponto, setPonto] = useState<{ latitude: number; longitude: number } | null>(null);
  const [origemPonto, setOrigemPonto] = useState<'gps' | 'manual' | 'padrao'>('padrao');
  const [localizando, setLocalizando] = useState(true);
  const [manancial, setManancial] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** Aplica o resultado do GPS (ou a cidade padrão, se indisponível e ainda sem ponto). */
  const aplicarPosicao = useCallback((p: Awaited<ReturnType<typeof obterLocalizacao>>) => {
    if (p) {
      setPonto({ latitude: p.latitude, longitude: p.longitude });
      setOrigemPonto('gps');
    } else {
      setPonto((atual) => atual ?? { latitude: CIDADE_PADRAO.latitude, longitude: CIDADE_PADRAO.longitude });
      setOrigemPonto((atual) => (atual === 'manual' ? atual : 'padrao'));
    }
    setLocalizando(false);
  }, []);

  const localizar = async () => {
    setLocalizando(true);
    aplicarPosicao(await obterLocalizacao());
  };

  useEffect(() => {
    let ativo = true;
    void obterLocalizacao().then((p) => ativo && aplicarPosicao(p));
    return () => {
      ativo = false;
    };
  }, [aplicarPosicao]);

  // Aviso de área de manancial: consulta o PostGIS (ST_Contains); offline, usa os polígonos em cache
  useEffect(() => {
    if (!ponto) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const r = online ? await apiOcorrencias.verificarManancial(ponto.latitude, ponto.longitude) : null;
        const nome = r ? r.manancial?.nome ?? null : manancialLocal(ponto, mananciais.data);
        if (!cancelado) setManancial(nome);
      } catch {
        if (!cancelado) setManancial(manancialLocal(ponto, mananciais.data));
      }
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [ponto, online, mananciais.data]);

  const escolherFoto = async (origem: 'camera' | 'galeria') => {
    setErro(null);
    try {
      if (origem === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setErro('Permita o acesso à câmera para fotografar a ocorrência.');
          return;
        }
      }
      const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: false, exif: false };
      const r = origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      if (a.fileSize && a.fileSize > LIMITE_FOTO) {
        setErro('A foto tem mais de 5 MB. Escolha uma imagem menor.');
        return;
      }
      const mime = a.mimeType && a.mimeType.startsWith('image/') ? a.mimeType : 'image/jpeg';
      setFoto({ uri: a.uri, mime, nome: a.fileName ?? `foto.${mime.split('/')[1] ?? 'jpg'}` });
    } catch (e) {
      setErro(`Não foi possível obter a foto: ${(e as Error).message}`);
    }
  };

  const problemas = {
    categoria: !categoria ? 'Escolha a categoria.' : null,
    descricao: descricao.trim().length < 5 ? 'Descreva a ocorrência (mínimo de 5 caracteres).' : null,
    ponto: !ponto ? 'Aguardando a localização.' : null,
  };
  const valido = !problemas.categoria && !problemas.descricao && !problemas.ponto;

  const enviar = async () => {
    setTocado(true);
    setErro(null);
    if (!valido || !categoria || !ponto) return;
    setEnviando(true);
    try {
      const r = await registrarOcorrencia({ categoria, severidade, descricao: descricao.trim(), latitude: ponto.latitude, longitude: ponto.longitude }, foto, online);
      if (r.tipo === 'enviada') {
        void qc.invalidateQueries({ queryKey: ['ocorrencias'] });
        router.replace(`/ocorrencia/${r.ocorrencia.id}?nova=1`);
      } else {
        router.replace('/envios?nova=1');
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={estilos.pagina} keyboardShouldPersistTaps="handled" testID="tela-nova-ocorrencia">
        {!online && (
          <Banner visible icon="wifi-off" style={{ borderRadius: 12 }}>
            Você está offline. A ocorrência será salva no aparelho e enviada automaticamente quando a conexão voltar.
          </Banner>
        )}

        <Text variant="titleMedium">1. O que está acontecendo?</Text>
        <SeletorCategoria valor={categoria} aoMudar={setCategoria} />
        {tocado && problemas.categoria && <HelperText type="error">{problemas.categoria}</HelperText>}

        <Text variant="titleMedium">2. Qual a gravidade?</Text>
        <SegmentedButtons
          value={severidade}
          onValueChange={(v) => setSeveridade(v as Severidade)}
          buttons={SEVERIDADES.map((s) => ({ value: s, label: SEVERIDADE[s].rotulo, testID: `severidade-${s}` }))}
        />

        <Text variant="titleMedium">3. Descreva</Text>
        <TextInput
          mode="outlined"
          label="Descrição"
          placeholder="Ex.: rua alagada, água na altura do joelho"
          value={descricao}
          onChangeText={setDescricao}
          multiline
          numberOfLines={4}
          maxLength={1000}
          error={tocado && Boolean(problemas.descricao)}
          testID="campo-descricao"
        />
        <HelperText type={tocado && problemas.descricao ? 'error' : 'info'}>{tocado && problemas.descricao ? problemas.descricao : `${descricao.length}/1000`}</HelperText>

        <Text variant="titleMedium">4. Foto (opcional)</Text>
        {foto ? (
          <View style={estilos.fotoCaixa}>
            <Image source={{ uri: foto.uri }} style={estilos.foto} contentFit="cover" accessibilityLabel="Foto selecionada" testID="previa-foto" />
            <IconButton icon="close" mode="contained" style={estilos.removerFoto} onPress={() => setFoto(null)} accessibilityLabel="Remover foto" />
          </View>
        ) : (
          <View style={estilos.linha}>
            {Platform.OS !== 'web' && (
              <Button mode="outlined" icon="camera" onPress={() => escolherFoto('camera')} style={{ flex: 1 }} testID="botao-camera">
                Câmera
              </Button>
            )}
            <Button mode="outlined" icon="image" onPress={() => escolherFoto('galeria')} style={{ flex: 1 }} testID="botao-galeria">
              {Platform.OS === 'web' ? 'Escolher foto' : 'Galeria'}
            </Button>
          </View>
        )}

        <Text variant="titleMedium">5. Onde?</Text>
        <Text variant="bodySmall" style={{ color: tema.extra.tintaSecundaria }}>
          {localizando
            ? 'Obtendo sua localização…'
            : origemPonto === 'gps'
              ? 'Usando sua localização atual. Toque no mapa ou arraste o pino para ajustar.'
              : origemPonto === 'manual'
                ? 'Local ajustado manualmente.'
                : 'Localização indisponível: toque no mapa para marcar o local.'}
        </Text>
        <View style={estilos.mapa} testID="mapa-registro">
          {ponto && (
            <Mapa
              regiaoInicial={{ ...ponto, delta: 0.02 }}
              pontoSelecionado={ponto}
              mananciais={mananciais.data}
              modoEscuro={tema.extra.escuro}
              centralizarEm={origemPonto === 'gps' ? { ...ponto, chave: Math.round(ponto.latitude * 1e6) } : null}
              aoTocarMapa={(c) => {
                setPonto(c);
                setOrigemPonto('manual');
              }}
            />
          )}
        </View>
        <View style={estilos.linha}>
          <Text variant="labelSmall" style={{ flex: 1, color: tema.extra.tintaFraca }} testID="coordenadas">
            {ponto ? `${ponto.latitude.toFixed(5)}, ${ponto.longitude.toFixed(5)}` : '—'}
          </Text>
          <Button icon="crosshairs-gps" compact onPress={localizar} loading={localizando}>
            Minha localização
          </Button>
        </View>
        {manancial && (
          <View style={[estilos.aviso, { backgroundColor: '#e0f2f7' }]} testID="aviso-manancial" accessibilityRole="alert">
            <Icone nome="water-alert" cor="#0e7490" />
            <Text variant="bodyMedium" style={{ flex: 1, color: '#0b4f61' }}>
              Este ponto está dentro da área de proteção do manancial <Text style={{ fontWeight: '800', color: '#0b4f61' }}>{manancial}</Text>. Ocorrências de invasão ou
              desmatamento aqui geram alerta prioritário.
            </Text>
          </View>
        )}

        {erro && (
          <HelperText type="error" visible style={{ fontSize: 14 }} testID="erro-registro">
            {erro}
          </HelperText>
        )}
        <Button mode="contained" icon={online ? 'send' : 'content-save'} onPress={enviar} loading={enviando} disabled={enviando} contentStyle={{ paddingVertical: 8 }} testID="botao-enviar-ocorrencia">
          {online ? 'Registrar ocorrência' : 'Salvar para enviar depois'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pagina: { padding: 16, gap: 10, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fotoCaixa: { position: 'relative' },
  foto: { width: '100%', height: 200, borderRadius: 14 },
  removerFoto: { position: 'absolute', top: 6, right: 6 },
  mapa: { height: 240, borderRadius: 14, overflow: 'hidden' },
  aviso: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, alignItems: 'center' },
});
