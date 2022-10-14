import { ethers } from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import { logger } from '../utility/Logger';

const _logger = logger.getLogger('NonceManage');

export class NonceManage extends NonceManager {
  private _pending: number = 0;
  private _waited: number = 0;
  private _threshold: number = 2;

  constructor(signer: ethers.Signer, threshold?: number) {
    super(signer);
    if (threshold) this._threshold = threshold;
  }

  async sendTransaction(
    txn: ethers.utils.Deferrable<ethers.providers.TransactionRequest>
  ): Promise<ethers.providers.TransactionResponse> {
    _logger.debug(`super send with ${this._pending} pending`);

    if (this._pending >= this._threshold) {
      const waiter: number = ++this._waited;
      _logger.debug(`  set aside as waiter ${waiter}`);
      await new Promise<void | string>((resolve: (x?: any) => void) => {
        const monitor: () => void = () => {
          if (this._pending >= this._threshold) setTimeout(monitor, 1000);
          else {
            ++this._pending;
            _logger.debug(`  releasing waiter ${waiter}`);
            resolve(`waiter ${waiter} resolved`);
          }
        };
        monitor();
      }); //await new Promise<
    } else ++this._pending;

    _logger.debug(`sendTransaction into ethers`);
    return super.sendTransaction(txn).then((txnResponse: ethers.providers.TransactionResponse) => {
      _logger.debug(`txn sent to node, decrementing pending to ${this._pending - 1}`);
      --this._pending;
      return txnResponse;
    });
  } //async sendTransaction(
} //class MyNonceMgr
