import { Platform } from 'react-native';

/**
 * URL base da API do backend (FastAPI).
 * - iOS simulador: localhost funciona
 * - Android emulador: use 10.0.2.2 para localhost da máquina
 * - Dispositivo físico: use o IP da sua máquina na rede (ex: 192.168.1.10)
 * Sobrescreva com EXPO_PUBLIC_API_URL no app.config.js ou .env
 */
export const getApiUrl = (): string => {
  const envUrl =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL
      ? process.env.EXPO_PUBLIC_API_URL
      : '';
  if (envUrl) return envUrl.replace(/\/$/, '');
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://localhost:8000';
};
