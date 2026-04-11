export {};

declare global {
  interface Window {
    fluxOneAdmin?: {
      apiUrl: string;
      nonce: string;
      adminUrl: string;
      pluginUrl: string;
      version: string;
      features: Record<string, { enabled: boolean }>;
      bootstrap?: unknown;
    };
  }
}

