// Location: src/lib/walletService.ts
// MiniPay + MetaMask Wallet Service with Smart Contract Entry on CELO Mainnet

import { 
    getAccount, 
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

// ─── Contract Config ────────────────────────────────────────────────────────

// Replace with your deployed contract address after running deploy.js
const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS || '') as `0x${string}`;

const CONTRACT_ABI = [
  {
    name: 'payEntry',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'canPlay',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'hasPaidEntry',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'entryFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── Constants ───────────────────────────────────────────────────────────────

const DIVVI_CONSUMER_ID = import.meta.env.VITE_DIVVI_CONSUMER_ID || '0xB6Bb848A8E00b77698CAb1626C893dc8ddE4927c';
const CELO_MAINNET_CHAIN_ID = 42220;
const GAME_ENTRY_FEE = '0.1'; // 0.1 USDT

console.log('✅ Wallet Service initialized — Smart Contract mode on CELO');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WalletState {
    account: string;
    currentNetwork: string;
    isConnecting: boolean;
    balance: string;
    isLoadingBalance: boolean;
}

export interface WalletCallbacks {
    onWalletChange?: (address: string) => void;
    onToast?: (title: string, description: string) => void;
}

// ─── Service ─────────────────────────────────────────────────────────────────

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

    private detectWallet(): 'minipay' | 'metamask' | 'unknown' {
        if (typeof window.ethereum === 'undefined') return 'unknown';
        if ((window.ethereum as any).isMiniPay) return 'minipay';
        if ((window.ethereum as any).isMetaMask) return 'metamask';
        return 'unknown';
    }

    async fetchBalance(address: string) {
        if (!address) return;
        this.updateState({ isLoadingBalance: true });
        try {
            const balance = await readContract(config, {
                address: USDT_CONTRACT_ADDRESS,
                abi: USDT_ABI,
                functionName: 'balanceOf',
                args: [address as `0x${string}`],
                chainId: CELO_MAINNET_CHAIN_ID,
            });
            const formatted = formatUnits(balance as bigint, USDT_DECIMALS);
            this.updateState({ balance: parseFloat(formatted).toFixed(2), isLoadingBalance: false });
            return formatted;
        } catch (error) {
            console.error('❌ Balance fetch error:', error);
            this.updateState({ balance: '0.00', isLoadingBalance: false });
        }
    }

    async checkNetwork() {
        try {
            const currentChainId = await getChainId(config);
            const networkName = currentChainId === CELO_MAINNET_CHAIN_ID ? 'Celo Mainnet' : `Chain ${currentChainId}`;
            this.updateState({ currentNetwork: networkName });
            if (currentChainId !== CELO_MAINNET_CHAIN_ID) {
                this.showToast("Wrong Network", "Please switch to CELO Mainnet in your wallet");
            }
        } catch (error) {
            this.updateState({ currentNetwork: 'Unknown' });
        }
    }

    private showToast(title: string, description: string) {
        this.callbacks.onToast?.(title, description);
    }

    async connectWallet() {
        this.updateState({ isConnecting: true });
        try {
            const walletType = this.detectWallet();
            if (walletType === 'unknown') throw new Error('No wallet detected. Please use MiniPay or MetaMask on CELO Mainnet.');

            const existingAccount = getAccount(config);
            if (existingAccount.isConnected && existingAccount.address) {
                this.updateState({ account: existingAccount.address });
                this.callbacks.onWalletChange?.(existingAccount.address);
                await this.checkNetwork();
                await this.fetchBalance(existingAccount.address);
                this.updateState({ isConnecting: false });
                return;
            }

            const connectors = config.connectors;
            if (connectors.length === 0) throw new Error('No wallet connector available');

            const result = await connect(config, {
                connector: connectors[0],
                chainId: CELO_MAINNET_CHAIN_ID,
            });

            this.updateState({ account: result.accounts[0] });
            this.callbacks.onWalletChange?.(result.accounts[0]);
            await this.checkNetwork();
            await this.fetchBalance(result.accounts[0]);
            localStorage.removeItem('wallet_disconnect_requested');
            this.showToast("Success", `${walletType === 'minipay' ? 'MiniPay' : 'MetaMask'} connected!`);
        } catch (error: any) {
            if (error.message?.includes('User rejected')) {
                this.showToast("Connection Rejected", "Please approve the connection in your wallet");
            } else {
                this.showToast("Connection Failed", error.message || "Failed to connect wallet");
            }
        } finally {
            this.updateState({ isConnecting: false });
        }
    }

    async disconnectWallet() {
        try {
            const connections = getConnections(config);
            for (const connection of connections) {
                await disconnect(config, { connector: connection.connector });
            }
        } catch (error) {
            console.error('Disconnect error:', error);
        }
        localStorage.setItem('wallet_disconnect_requested', 'true');
        this.updateState({ account: '', currentNetwork: '', balance: '' });
        this.callbacks.onWalletChange?.('');
        this.showToast("Success", "Wallet disconnected");
    }

    formatAddress(address: string): string {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Check if the connected player has already paid for a session on-chain.
     */
    async checkCanPlay(address: string): Promise<boolean> {
        try {
            const result = await readContract(config, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'canPlay',
                args: [address as `0x${string}`],
                chainId: CELO_MAINNET_CHAIN_ID,
            });
            return result as boolean;
        } catch (error) {
            console.error('❌ canPlay check error:', error);
            return false;
        }
    }

    /**
     * Pay the game entry fee via the smart contract.
     * Step 1: Approve the contract to spend 0.1 USDT
     * Step 2: Call payEntry() on the contract
     */
    public async sendPayment(): Promise<boolean> {
        console.log('💸 Starting smart contract entry payment...');

        const account = getAccount(config);
        if (!account.address || !account.isConnected) throw new Error('Wallet not connected');

        const currentChainId = await getChainId(config);
        if (currentChainId !== CELO_MAINNET_CHAIN_ID) {
            throw new Error('Please switch to CELO Mainnet in your wallet (Chain ID: 42220)');
        }

        const amountInUsdtWei = parseUnits(GAME_ENTRY_FEE, USDT_DECIMALS);

        // ── Check USDT balance ───────────────────────────────────────────────
        const balance = await readContract(config, {
            address: USDT_CONTRACT_ADDRESS,
            abi: USDT_ABI,
            functionName: 'balanceOf',
            args: [account.address as `0x${string}`],
            chainId: CELO_MAINNET_CHAIN_ID,
        });

        if ((balance as bigint) < amountInUsdtWei) {
            const formatted = formatUnits(balance as bigint, USDT_DECIMALS);
            throw new Error(
                `Insufficient USDT balance. You need ${GAME_ENTRY_FEE} USDT but have ${parseFloat(formatted).toFixed(2)} USDT.`
            );
        }

        // ── Step 1: Approve contract to spend USDT ──────────────────────────
        console.log('📝 Step 1/2: Approving USDT spend...');
        this.showToast('Approval Required', 'Please approve USDT spend in your wallet (1 of 2)');

        const approveTxHash = await writeContract(config, {
            address: USDT_CONTRACT_ADDRESS,
            abi: USDT_ABI,
            functionName: 'approve',
            args: [CONTRACT_ADDRESS, amountInUsdtWei],
            chainId: CELO_MAINNET_CHAIN_ID,
        });

        await waitForTransactionReceipt(config, {
            hash: approveTxHash,
            chainId: CELO_MAINNET_CHAIN_ID,
        });

        console.log('✅ Approval confirmed');

        // ── Step 2: Call payEntry() on the contract ──────────────────────────
        console.log('📤 Step 2/2: Paying entry fee to contract...');
        this.showToast('Payment Required', 'Please confirm entry fee payment (2 of 2)');

        // Generate Divvi referral tag for tracking
        let referralTag = getReferralTag({
            user: account.address,
            consumer: DIVVI_CONSUMER_ID,
        });
        if (referralTag && !referralTag.startsWith('0x')) {
            referralTag = `0x${referralTag}`;
        }

        const payTxHash = await writeContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'payEntry',
            chainId: CELO_MAINNET_CHAIN_ID,
        });

        this.showToast('Transaction Sent', 'Waiting for confirmation...');

        const receipt = await waitForTransactionReceipt(config, {
            hash: payTxHash,
            chainId: CELO_MAINNET_CHAIN_ID,
        });

        if (receipt.status === 'success') {
            console.log('✅ Entry payment confirmed!');

            // Submit to Divvi
            try {
                await submitReferral({ txHash: payTxHash, chainId: CELO_MAINNET_CHAIN_ID });
            } catch (divviError) {
                console.warn('⚠️ Divvi submission failed:', divviError);
            }

            await this.fetchBalance(account.address);
            this.showToast('Payment Success', 'Entry fee paid! Starting game...');
            return true;
        } else {
            throw new Error('Transaction failed on-chain');
        }
    }

    private async initialize() {
        try {
            const wasDisconnected = localStorage.getItem('wallet_disconnect_requested');
            if (wasDisconnected === 'true') return;

            const walletType = this.detectWallet();
            if (walletType === 'unknown') return;

            await reconnect(config);
            await new Promise(resolve => setTimeout(resolve, 800));

            const account = getAccount(config);
            if (account.address && account.isConnected) {
                this.updateState({ account: account.address });
                this.callbacks.onWalletChange?.(account.address);

                this.unwatchAccount = watchAccount(config, {
                    onChange: (newAccount) => {
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
                setTimeout(() => {
                    if (account.address) this.fetchBalance(account.address);
                }, 1000);
            }
        } catch (error) {
            console.error('❌ Initialization error:', error);
        }
    }

    destroy() {
        this.unwatchAccount?.();
    }
}
