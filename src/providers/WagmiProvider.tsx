// Location: src/providers/WagmiProvider.tsx
// MiniPay Wallet Configuration - CELO Mainnet Only

import { WagmiProvider, createConfig, http } from 'wagmi';
import { celo } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { injected } from 'wagmi/connectors';

// MiniPay Configuration - Uses injected connector (MiniPay's built-in wallet)
const config = createConfig({
  chains: [celo], // ONLY CELO Mainnet
  transports: {
    [celo.id]: http('https://forno.celo.org'), // Official CELO RPC
  },
  connectors: [
    injected({
      // MiniPay injects window.ethereum automatically
      target: 'metaMask', // MiniPay is MetaMask-compatible
    }),
  ],
  multiInjectedProviderDiscovery: false,
});

console.log('🔧 MiniPay Wagmi Config:', {
  chains: config.chains.map(c => ({ id: c.id, name: c.name })),
  connector: 'MiniPay Injected Wallet',
});

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

interface WagmiProviderWrapperProps {
  children: ReactNode;
}

export function WagmiProviderWrapper({ children }: WagmiProviderWrapperProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { config };