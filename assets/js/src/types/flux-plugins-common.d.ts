declare module '@flux-plugins-common/components' {
  import * as React from 'react';

  export const UpsellCard: React.ComponentType<{
    intro?: string;
    bullets?: string[];
  }>;
}

