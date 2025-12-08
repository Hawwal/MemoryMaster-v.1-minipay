// Location: src/lib/walletService.ts
// MiniPay Wallet Service with USDT Payments on CELO Mainnet

import { getAccount, sendTransaction, waitForTransactionReceipt, getChainId, reconnect, watchAccount, readContract, writeContract } from '@wagmi/core';
import { config } from '@/providers/WagmiProvider';
import { formatUnits, parseUnits, createPublicClient, http } from 'viem';
import { celo } from 'wagmi/chains';
import { getReferralTag, submitReferral } from '@divvi/referral-sdk';
import { USDT_ABI, USDT_CONTRACT_ADDRESS, USDT_DECIMALS } from '@/lib/usdtAbi';

// Divvi Consumer ID
const DIVVI_CONSUMER_ID = import.meta.env.VITE_DIVVI_CONSUMER_ID || '0xB6Bb848A8E00b77698CAb1626C893dc8ddE4927c';

// CELO Mainnet Chain ID
const CELO_MAINNET_CHAIN_ID = 42220;

// Direct CELO public client
const celoPublicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org'),
});

console.log('✅ MiniPay Wallet Service initialized');

export interface WalletState {
    account: string;
    currentNetwork: string;
    isConnecting: boolean;
    balance: string; // USDT balance
    isLoadingBalance: boolean;
}

export interface WalletCallbacks {
    onWalletChange?: (address: string) => void;
    onToast?: (title: string, description: string) => void;
}

export class WalletService {
    private state: WalletState = {
        account: '',
        currentNetwork: '',
        isConnecting: false,
        balance: '',
        isLoadingBalance: false
    };
    private callbacks: WalletCallbacks = {};
    private stateUpdateCallback?: (state: WalletState) => void;
    private unwatchAccount?: () => void;

    constructor(callbacks?: WalletCallbacks) {
        this.callbacks = callbacks || {};
        this.initialize();
    }

    private updateState(updates: Partial<WalletState>) {
        this.state = { ...this.state, ...updates };
        this.stateUpdateCallback?.(this.state);
    }

    onStateUpdate(callback: (state: WalletState) => void) {
        this.stateUpdateCallback = callback;
        callback(this.state);
    }

    /**
     * Fetch USDT balance (not native CELO)
     */
    async fetchBalance(address: string) {
        if (!address) {
            console.log('⚠️ [fetchBalance] No address provided');
            return;
        }
        
        console.log('💰 [fetchBalance] Fetching USDT balance for:', address);
        this.updateState({ isLoadingBalance: true });
        
        try {
            // Read USDT balance from contract
            const balance = await readContract(config, {
                address: USDT_CONTRACT_ADDRESS,
                abi: USDT_ABI,
                functionName: 'balanceOf',
                args: [address as `0x${string}`],
                chainId: CELO_MAINNET_CHAIN_ID,
            });

            // Format with 6 decimals (USDT has 6, not 18)
            const formattedBalance = formatUnits(balance as bigint, USDT_DECIMALS);
            
            console.log('✅ [fetchBalance] USDT balance:', formattedBalance, 'USDT');
            
            this.updateState({ 
                balance: parseFloat(formattedBalance).toFixed(2),
                isLoadingBalance: false
            });
            
            return formattedBalance;
        } catch (error) {
            console.error('❌ [fetchBalance] Error:', error);
            this.updateState({ 
                balance: '0.00', 
                isLoadingBalance: false 
            });
            this.showToast("Error", "Failed to fetch USDT balance");
        }
    }

    async checkNetwork() {
        try {
            const currentChainId = await getChainId(config);
            const networkName = currentChainId === CELO_MAINNET_CHAIN_ID ? 'Celo Mainnet' : `Chain ${currentChainId}`;
            
            console.log('🌐 [checkNetwork]:', networkName);
            this.updateState({ currentNetwork: networkName });
        } catch (error) {
            console.error('❌ [checkNetwork] Error:', error);
            this.updateState({ currentNetwork: 'Unknown' });
        }
    }

    private showToast(title: string, description: string) {
        this.callbacks.onToast?.(title, description);
    }

    async connectWallet() {
        console.log('🔌 [connectWallet] MiniPay auto-connect...');
        this.updateState({ isConnecting: true });
        
        try {
            // MiniPay auto-connects when app opens
            await reconnect(config);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const account = getAccount(config);
            
            if (account.address && account.isConnected) {
                console.log('✅ [connectWallet] Connected:', account.address);
                this.updateState({ account: account.address });
                this.callbacks.onWalletChange?.(account.address);
                
                await this.checkNetwork();
                await this.fetchBalance(account.address);
                
                localStorage.removeItem('wallet_disconnect_requested');
                this.showToast("Success", "MiniPay wallet connected!");
            } else {
                throw new Error('Please open this app in MiniPay');
            }
        } catch (error: any) {
            console.error('❌ [connectWallet] Error:', error);
            this.showToast("Error", error.message || "Failed to connect");
        } finally {
            this.updateState({ isConnecting: false });
        }
    }

    async disconnectWallet() {
        console.log('🔌 [disconnectWallet]');
        localStorage.setItem('wallet_disconnect_requested', 'true');
        
        this.updateState({
            account: '',
            currentNetwork: '',
            balance: ''
        });
        
        this.callbacks.onWalletChange?.('');
        this.showToast("Success", "Disconnected!");
    }

    formatAddress(address: string): string {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Send USDT payment (ERC20 transfer) with Divvi tracking
     */
    public async sendPayment(toAddress: string, amountInUsdt: string): Promise<boolean> {
        console.log('💸 [sendPayment] Starting USDT payment...');
        console.log('💸 [sendPayment] To:', toAddress);
        console.log('💸 [sendPayment] Amount:', amountInUsdt, 'USDT');
        
        const account = getAccount(config);
        
        if (!account.address || !account.isConnected) {
            throw new Error('Wallet not connected');
        }

        try {
            // Validate recipient
            if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
                throw new Error('Invalid recipient address');
            }

            // Verify CELO mainnet
            const currentChainId = await getChainId(config);
            if (currentChainId !== CELO_MAINNET_CHAIN_ID) {
                throw new Error('Must be on CELO Mainnet');
            }

            // Convert amount to USDT decimals (6, not 18)
            const amountInUsdtWei = parseUnits(amountInUsdt, USDT_DECIMALS);
            console.log('💰 [sendPayment] Amount in USDT wei:', amountInUsdtWei.toString());

            // Check USDT balance
            const balance = await readContract(config, {
                address: USDT_CONTRACT_ADDRESS,
                abi: USDT_ABI,
                functionName: 'balanceOf',
                args: [account.address as `0x${string}`],
                chainId: CELO_MAINNET_CHAIN_ID,
            });

            console.log('💰 [sendPayment] USDT Balance:', formatUnits(balance as bigint, USDT_DECIMALS), 'USDT');

            if ((balance as bigint) < amountInUsdtWei) {
                throw new Error(`Insufficient USDT balance. Need ${amountInUsdt} USDT, have ${formatUnits(balance as bigint, USDT_DECIMALS)} USDT`);
            }

            // Generate Divvi referral tag
            let referralTag = getReferralTag({
                user: account.address,
                consumer: DIVVI_CONSUMER_ID,
            });
            
            if (referralTag && !referralTag.startsWith('0x')) {
                referralTag = `0x${referralTag}`;
            }
            
            console.log('🏷️ [sendPayment] Divvi tag:', referralTag);

            // Execute USDT transfer
            console.log('📤 [sendPayment] Sending USDT transfer...');
            const txHash = await writeContract(config, {
                address: USDT_CONTRACT_ADDRESS,
                abi: USDT_ABI,
                functionName: 'transfer',
                args: [toAddress as `0x${string}`, amountInUsdtWei],
                chainId: CELO_MAINNET_CHAIN_ID,
            });

            this.showToast('Transaction Sent', 'Confirming USDT transfer...');
            console.log('📤 [sendPayment] TX hash:', txHash);

            // Wait for confirmation
            const receipt = await waitForTransactionReceipt(config, {
                hash: txHash,
                chainId: CELO_MAINNET_CHAIN_ID,
            });

            if (receipt.status === 'success') {
                console.log('✅ [sendPayment] USDT transfer confirmed!');

                // Submit to Divvi
                try {
                    await submitReferral({
                        txHash: txHash,
                        chainId: CELO_MAINNET_CHAIN_ID,
                    });
                    console.log('✅ [sendPayment] Divvi submitted');
                } catch (divviError) {
                    console.warn('⚠️ [sendPayment] Divvi failed:', divviError);
                }

                // Refresh USDT balance
                await this.fetchBalance(account.address);
                
                this.showToast('Success', `${amountInUsdt} USDT sent successfully!`);
                return true;
            } else {
                throw new Error('Transaction failed');
            }
        } catch (error: any) {
            console.error('💥 [sendPayment] Error:', error);
            
            if (error.message?.includes('rejected') || error.message?.includes('denied')) {
                throw new Error('Transaction rejected by user');
            }
            
            throw new Error(error.message || 'USDT payment failed');
        }
    }

    private async initialize() {
        try {
            console.log('🚀 [initialize] MiniPay wallet service...');
            
            const wasDisconnected = localStorage.getItem('wallet_disconnect_requested');
            if (wasDisconnected === 'true') {
                console.log('⚠️ [initialize] Previously disconnected');
                return;
            }

            // MiniPay auto-connects
            await reconnect(config);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const account = getAccount(config);
            
            if (account.address && account.isConnected) {
                console.log('🔗 [initialize] Auto-connected:', account.address);
                
                this.updateState({ account: account.address });
                this.callbacks.onWalletChange?.(account.address);
                
                // Watch for changes
                this.unwatchAccount = watchAccount(config, {
                    onChange: (account) => {
                        if (account.address) {
                            this.updateState({ account: account.address });
                            this.callbacks.onWalletChange?.(account.address);
                            this.fetchBalance(account.address);
                        }
                    }
                });
                
                await this.checkNetwork();
                
                setTimeout(() => {
                    if (account.address) {
                        this.fetchBalance(account.address);
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('❌ [initialize] Error:', error);
        }
    }

    destroy() {
        console.log('🧹 [destroy] Cleanup');
        this.unwatchAccount?.();
    }
}