// Location: src/lib/walletService.ts
// MiniPay + MetaMask Wallet Service with USDT Payments on CELO Mainnet

import { 
    getAccount, 
    sendTransaction, 
    waitForTransactionReceipt, 
    getChainId, 
    reconnect, 
    watchAccount, 
    readContract, 
    writeContract, 
    connect, 
    getConnections, 
    disconnect 
} from '@wagmi/core';
import { config } from '@/providers/WagmiProvider';
import { formatUnits, parseUnits } from 'viem';
import { getReferralTag, submitReferral } from '@divvi/referral-sdk';
import { USDT_ABI, USDT_CONTRACT_ADDRESS, USDT_DECIMALS } from '@/lib/usdtAbi';

// Divvi Consumer ID
const DIVVI_CONSUMER_ID = import.meta.env.VITE_DIVVI_CONSUMER_ID || '0xB6Bb848A8E00b77698CAb1626C893dc8ddE4927c';

// CELO Mainnet Chain ID
const CELO_MAINNET_CHAIN_ID = 42220;

console.log('✅ Wallet Service initialized for USDT on CELO');

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
     * Detect wallet type
     */
    private detectWallet(): 'minipay' | 'metamask' | 'unknown' {
        if (typeof window.ethereum === 'undefined') {
            return 'unknown';
        }
        
        // Check for MiniPay
        if ((window.ethereum as any).isMiniPay) {
            return 'minipay';
        }
        
        // Check for MetaMask
        if ((window.ethereum as any).isMetaMask) {
            return 'metamask';
        }
        
        // Has ethereum but unknown type
        return 'unknown';
    }

    /**
     * Fetch USDT balance (not native CELO)
     */
    async fetchBalance(address: string) {
        if (!address) {
            console.log('⚠️ No address provided');
            return;
        }
        
        console.log('💰 Fetching USDT balance for:', address);
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
            
            console.log('✅ USDT balance:', formattedBalance, 'USDT');
            
            this.updateState({ 
                balance: parseFloat(formattedBalance).toFixed(2),
                isLoadingBalance: false
            });
            
            return formattedBalance;
        } catch (error) {
            console.error('❌ Balance fetch error:', error);
            this.updateState({ 
                balance: '0.00', 
                isLoadingBalance: false 
            });
        }
    }

    async checkNetwork() {
        try {
            const currentChainId = await getChainId(config);
            const networkName = currentChainId === CELO_MAINNET_CHAIN_ID ? 'Celo Mainnet' : `Chain ${currentChainId}`;
            
            console.log('🌐 Network:', networkName, '(ID:', currentChainId, ')');
            this.updateState({ currentNetwork: networkName });
            
            // If not on CELO, show error
            if (currentChainId !== CELO_MAINNET_CHAIN_ID) {
                this.showToast("Wrong Network", "Please switch to CELO Mainnet in your wallet");
            }
        } catch (error) {
            console.error('❌ Network check error:', error);
            this.updateState({ currentNetwork: 'Unknown' });
        }
    }

    private showToast(title: string, description: string) {
        this.callbacks.onToast?.(title, description);
    }

    async connectWallet() {
        console.log('🔌 Connecting wallet...');
        this.updateState({ isConnecting: true });
        
        try {
            const walletType = this.detectWallet();
            console.log('🔍 Detected wallet:', walletType);
            
            if (walletType === 'unknown') {
                throw new Error('No wallet detected. Please use MiniPay or MetaMask on CELO Mainnet.');
            }

            // Check if already connected
            const existingAccount = getAccount(config);
            if (existingAccount.isConnected && existingAccount.address) {
                console.log('✅ Already connected:', existingAccount.address);
                this.updateState({ account: existingAccount.address });
                this.callbacks.onWalletChange?.(existingAccount.address);
                await this.checkNetwork();
                await this.fetchBalance(existingAccount.address);
                this.updateState({ isConnecting: false });
                return;
            }

            // Get available connectors
            const connectors = config.connectors;
            console.log('🔗 Available connectors:', connectors.length);

            if (connectors.length === 0) {
                throw new Error('No wallet connector available');
            }

            // Try to connect with first available connector
            const result = await connect(config, {
                connector: connectors[0],
                chainId: CELO_MAINNET_CHAIN_ID,
            });

            console.log('✅ Connected:', result.accounts[0]);
            
            this.updateState({ account: result.accounts[0] });
            this.callbacks.onWalletChange?.(result.accounts[0]);
            
            await this.checkNetwork();
            await this.fetchBalance(result.accounts[0]);
            
            localStorage.removeItem('wallet_disconnect_requested');
            this.showToast("Success", `${walletType === 'minipay' ? 'MiniPay' : 'MetaMask'} connected!`);
            
        } catch (error: any) {
            console.error('❌ Connection error:', error);
            
            // Provide helpful error messages
            if (error.message?.includes('User rejected')) {
                this.showToast("Connection Rejected", "Please approve the connection in your wallet");
            } else if (error.message?.includes('No wallet')) {
                this.showToast("No Wallet Found", "Please use MiniPay or install MetaMask");
            } else {
                this.showToast("Connection Failed", error.message || "Failed to connect wallet");
            }
        } finally {
            this.updateState({ isConnecting: false });
        }
    }

    async disconnectWallet() {
        console.log('🔌 Disconnecting...');
        
        try {
            const connections = getConnections(config);
            for (const connection of connections) {
                await disconnect(config, { connector: connection.connector });
            }
        } catch (error) {
            console.error('Disconnect error:', error);
        }
        
        localStorage.setItem('wallet_disconnect_requested', 'true');
        
        this.updateState({
            account: '',
            currentNetwork: '',
            balance: ''
        });
        
        this.callbacks.onWalletChange?.('');
        this.showToast("Success", "Wallet disconnected");
    }

    formatAddress(address: string): string {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Send USDT payment (ERC20 transfer) with Divvi tracking
     */
    public async sendPayment(toAddress: string, amountInUsdt: string): Promise<boolean> {
        console.log('💸 Starting USDT payment...');
        console.log('💸 To:', toAddress);
        console.log('💸 Amount:', amountInUsdt, 'USDT');
        
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
            console.log('🌐 Current chain:', currentChainId);
            
            if (currentChainId !== CELO_MAINNET_CHAIN_ID) {
                throw new Error('Please switch to CELO Mainnet in your wallet (Chain ID: 42220)');
            }

            // Convert amount to USDT decimals (6, not 18)
            const amountInUsdtWei = parseUnits(amountInUsdt, USDT_DECIMALS);
            console.log('💰 Amount in USDT wei:', amountInUsdtWei.toString());

            // Check USDT balance
            const balance = await readContract(config, {
                address: USDT_CONTRACT_ADDRESS,
                abi: USDT_ABI,
                functionName: 'balanceOf',
                args: [account.address as `0x${string}`],
                chainId: CELO_MAINNET_CHAIN_ID,
            });

            const balanceFormatted = formatUnits(balance as bigint, USDT_DECIMALS);
            console.log('💰 Your USDT balance:', balanceFormatted, 'USDT');
            console.log('💸 Amount needed:', amountInUsdt, 'USDT');

            if ((balance as bigint) < amountInUsdtWei) {
                throw new Error(
                    `Insufficient USDT balance. You need ${amountInUsdt} USDT but only have ${balanceFormatted} USDT. ` +
                    `Please add USDT to your wallet on CELO Mainnet.`
                );
            }

            // Generate Divvi referral tag
            let referralTag = getReferralTag({
                user: account.address,
                consumer: DIVVI_CONSUMER_ID,
            });
            
            if (referralTag && !referralTag.startsWith('0x')) {
                referralTag = `0x${referralTag}`;
            }
            
            console.log('🏷️ Divvi tag generated');

            // Execute USDT transfer
            console.log('📤 Sending USDT transfer transaction...');
            const txHash = await writeContract(config, {
                address: USDT_CONTRACT_ADDRESS,
                abi: USDT_ABI,
                functionName: 'transfer',
                args: [toAddress as `0x${string}`, amountInUsdtWei],
                chainId: CELO_MAINNET_CHAIN_ID,
            });

            this.showToast('Transaction Sent', 'Waiting for confirmation...');
            console.log('📤 TX hash:', txHash);

            // Wait for confirmation
            const receipt = await waitForTransactionReceipt(config, {
                hash: txHash,
                chainId: CELO_MAINNET_CHAIN_ID,
            });

            if (receipt.status === 'success') {
                console.log('✅ USDT transfer confirmed!');

                // Submit to Divvi
                try {
                    await submitReferral({
                        txHash: txHash,
                        chainId: CELO_MAINNET_CHAIN_ID,
                    });
                    console.log('✅ Divvi referral submitted');
                } catch (divviError) {
                    console.warn('⚠️ Divvi submission failed:', divviError);
                }

                // Refresh USDT balance
                await this.fetchBalance(account.address);
                
                this.showToast('Payment Success', `${amountInUsdt} USDT sent successfully!`);
                return true;
            } else {
                throw new Error('Transaction failed');
            }
        } catch (error: any) {
            console.error('💥 Payment error:', error);
            
            if (error.message?.includes('rejected') || error.message?.includes('denied')) {
                throw new Error('Transaction rejected by user');
            }
            
            if (error.message?.includes('Insufficient')) {
                throw error;
            }
            
            throw new Error(error.message || 'USDT payment failed');
        }
    }

    private async initialize() {
        try {
            console.log('🚀 Initializing wallet service...');
            
            const wasDisconnected = localStorage.getItem('wallet_disconnect_requested');
            if (wasDisconnected === 'true') {
                console.log('⚠️ User previously disconnected');
                return;
            }

            const walletType = this.detectWallet();
            console.log('🔍 Wallet detected:', walletType);

            if (walletType === 'unknown') {
                console.log('⚠️ No wallet detected on page load');
                return;
            }

            // Try auto-reconnect
            console.log('🔄 Attempting auto-reconnect...');
            await reconnect(config);
            await new Promise(resolve => setTimeout(resolve, 800));
            
            const account = getAccount(config);
            
            if (account.address && account.isConnected) {
                console.log('🔗 Auto-connected to:', account.address);
                console.log('🔗 Wallet type:', walletType);
                
                this.updateState({ account: account.address });
                this.callbacks.onWalletChange?.(account.address);
                
                // Watch for account changes
                this.unwatchAccount = watchAccount(config, {
                    onChange: (newAccount) => {
                        console.log('👀 Account changed:', newAccount.address);
                        if (newAccount.address && newAccount.isConnected) {
                            this.updateState({ account: newAccount.address });
                            this.callbacks.onWalletChange?.(newAccount.address);
                            this.fetchBalance(newAccount.address);
                        } else {
                            this.updateState({ account: '', balance: '' });
                            this.callbacks.onWalletChange?.('');
                        }
                    }
                });
                
                await this.checkNetwork();
                
                // Fetch balance after a short delay
                setTimeout(() => {
                    if (account.address) {
                        this.fetchBalance(account.address);
                    }
                }, 1000);
            } else {
                console.log('⚠️ Wallet detected but not connected');
            }
        } catch (error) {
            console.error('❌ Initialization error:', error);
        }
    }

    destroy() {
        console.log('🧹 Cleanup');
        this.unwatchAccount?.();
    }
}