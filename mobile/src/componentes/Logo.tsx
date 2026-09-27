import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { MARCA } from '@/tema/cores';

/** Logotipo do EcoRadar (mesmo desenho do ícone do app e do PDF): radar + folha. */
export function Logo({ tamanho = 64, comFundo = false }: { tamanho?: number; comFundo?: boolean }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 100 100" accessibilityLabel="Logotipo do EcoRadar Urbano">
      {comFundo && (
        <>
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={MARCA.verde} />
              <Stop offset="1" stopColor={MARCA.azul} />
            </LinearGradient>
          </Defs>
          <Rect width="100" height="100" rx="24" fill="url(#g)" />
        </>
      )}
      <Circle cx="50" cy="50" r={comFundo ? 36 : 46} fill="#ffffff" />
      <Path
        d={comFundo ? 'M 47 34.9 A 15.1 15.1 0 0 1 65.1 53 M 45.5 27.8 A 22.3 22.3 0 0 1 72.2 54.5 M 44.1 20.5 A 29.5 29.5 0 0 1 79.5 55.9' : 'M 46.14 30.68 A 19.32 19.32 0 0 1 69.32 53.86 M 44.3 21.48 A 28.52 28.52 0 0 1 78.52 55.7 M 42.46 12.28 A 37.72 37.72 0 0 1 87.72 57.54'}
        stroke={MARCA.azul}
        strokeWidth={comFundo ? 3.6 : 4.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={comFundo ? 'M 32 67 C 30.2 45.4 46.4 36.4 60.8 38.2 C 60.8 54.4 50 68.8 32 67 Z' : 'M 27 73 C 24.7 45.4 45.4 33.9 63.8 36.2 C 63.8 56.9 50 75.3 27 73 Z'}
        fill={MARCA.folha}
      />
    </Svg>
  );
}
