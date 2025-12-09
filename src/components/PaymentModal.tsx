import React from 'react';
import { Coins, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPayment: () => void;
  isLoading: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onPayment,
  isLoading
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Coins className="w-6 h-6 text-game-primary" />
            Enter the Game
          </DialogTitle>
          <DialogDescription>
            Pay with USDT on CELO Mainnet to play
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Payment Details */}
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Entry Fee</span>
              <span className="font-bold text-lg text-game-primary">0.1 USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Token</span>
              <span className="text-sm font-medium">USDT (Tether)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Network</span>
              <span className="text-sm font-medium">Celo Mainnet</span>
            </div>
          </div>
          
          {/* Security Note */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-600 dark:text-blue-400">
                <p className="font-medium mb-1">Secure Payment</p>
                <p className="text-xs opacity-90">
                  Your transaction is secured by CELO blockchain. 
                  Approve the payment in your wallet to continue.
                </p>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={onPayment}
              disabled={isLoading}
              className="flex-1 bg-game-primary hover:bg-game-primary/90 text-white"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Processing...
                </span>
              ) : (
                'Pay 0.1 USDT'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};