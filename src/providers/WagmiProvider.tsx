// Location: src/providers/WagmiProvider.tsx
// MiniPay + MetaMask Wallet Configuration - CELO Mainnet Only

import { WagmiProvider, createConfig, http } from 'wagmi';
import { celo } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { injected } from 'wagmi/connectors';

// MiniPay Configuration
// Supports both MiniPay and MetaMask on CELO Mainnet
const config = createConfig({
  chains: [celo], // ONLY CELO Mainnet
  transports: {
    [celo.id]: http('https://forno.celo.org'), // Official CELO RPC
  },
  connectors: [
    injected({
      // This will detect MiniPay, MetaMask, or any injected wallet
      shimDisconnect: false,
    }),
  ],
  multiInjectedProviderDiscovery: true, // Allow multiple wallet detection
});

console.log('🔧 Wallet Config: MiniPay + MetaMask on CELO Mainnet');

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