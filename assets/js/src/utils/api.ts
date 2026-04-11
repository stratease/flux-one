import apiFetch from '@wordpress/api-fetch';

function getConfig() {
  const cfg = window.fluxOneAdmin;
  if (!cfg) {
    throw new Error('Missing window.fluxOneAdmin config');
  }
  return cfg;
}

function withNonce(options: Record<string, any> = {}) {
  const cfg = getConfig();
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      'X-WP-Nonce': cfg.nonce,
    },
  };
}

export const api = {
  async getBootstrap() {
    const cfg = getConfig();
    return apiFetch(
      withNonce({
        path: '/flux-one/v1/bootstrap',
        method: 'GET',
      })
    ).then((data) => {
      cfg.bootstrap = data;
      return data;
    });
  },

  async getPluginsIndex(q: string = '') {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return apiFetch(withNonce({ path: `/flux-one/v1/index/plugins${qs}`, method: 'GET' }));
  },

  async getUsersIndex(q: string = '') {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return apiFetch(withNonce({ path: `/flux-one/v1/index/users${qs}`, method: 'GET' }));
  },

  async getMenusIndex() {
    return apiFetch(withNonce({ path: `/flux-one/v1/index/menus`, method: 'GET' }));
  },

  async getSitesIndex(q: string = '') {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return apiFetch(withNonce({ path: `/flux-one/v1/index/sites${qs}`, method: 'GET' }));
  },

  async getDestinationsIndex(q: string = '') {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return apiFetch(withNonce({ path: `/flux-one/v1/index/destinations${qs}`, method: 'GET' }));
  },

  async executeCommand(input: string) {
    return apiFetch(
      withNonce({
        path: '/flux-one/v1/command',
        method: 'POST',
        data: { input },
      })
    );
  },

  async getEmailAggregate(days: number = 7) {
    return apiFetch(
      withNonce({
        path: `/flux-one/v1/aggregate/email?days=${encodeURIComponent(String(days))}`,
        method: 'GET',
      })
    );
  },

  async getEmailSummary() {
    return apiFetch(
      withNonce({
        path: '/flux-one/v1/summary/email',
        method: 'POST',
      })
    );
  },
};

