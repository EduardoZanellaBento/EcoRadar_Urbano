// Tipagem comum das implementações por plataforma:
//   Mapa.native.tsx (react-native-maps) e Mapa.web.tsx (react-leaflet + OpenStreetMap).
// O Metro escolhe o arquivo certo pela extensão; o TypeScript usa esta declaração.
import type { ComponentType } from 'react';
import type { PropsMapa } from './tipos';

declare const Mapa: ComponentType<PropsMapa>;
export default Mapa;
