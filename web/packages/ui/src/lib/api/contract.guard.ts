import { api } from './client';

export async function __contractGuard(): Promise<void> {
  const { data } = await api.GET('/health');
  if (data) {
    const service: string = data.service;
    const timestamp: string = data.timestamp;
    void service;
    void timestamp;
  }
  // @ts-expect-error
  await api.GET('/route-absente-du-contrat');
}
