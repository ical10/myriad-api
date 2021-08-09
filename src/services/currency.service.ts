import {options} from '@acala-network/api';
import {service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ApiPromise, WsProvider} from '@polkadot/api';
import {ApiOptions} from '@polkadot/api/types';
import {DefaultCurrencyType, RpcType} from '../enums';
import {PolkadotJs} from '../helpers/polkadotJs-utils';
import {Balance, PaymentInfo} from '../interfaces';
import {Transaction, UserCurrency, UserSocialMedia} from '../models';
import {
  CurrencyRepository,
  PeopleRepository,
  QueueRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {TransactionService} from './transaction.service';

export class CurrencyService {
  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(QueueRepository)
    protected queueRepository: QueueRepository,
    @service(TransactionService)
    protected transactionService: TransactionService,
  ) {}

  async defaultCurrency(userId: string): Promise<void> {
    const currencies = [
      {
        id: DefaultCurrencyType.MYR,
        name: 'myriad',
        decimal: 12,
        image: 'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
        addressType: 214,
        rpcURL: process.env.MYRIAD_WS_RPC ?? RpcType.LOCALRPC,
        native: true,
      },
      {
        id: DefaultCurrencyType.AUSD,
        name: 'ausd',
        decimal: 12,
        image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
        addressType: 42,
        rpcURL: 'wss://acala-mandala.api.onfinality.io/public-ws',
        native: false,
      },
    ];
    for (const currency of currencies) {
      try {
        await this.userRepository.currencies(userId).create(currency);
      } catch {
        this.userCurrencyRepository.create({
          userId: userId,
          currencyId: currency.id,
        }) as Promise<UserCurrency>;
      }
    }
  }

  async defaultAcalaTips(userId: string): Promise<void> {
    try {
      const rpcURL = 'wss://acala-mandala.api.onfinality.io/public-ws';
      const provider = new WsProvider(rpcURL);
      const api = await new ApiPromise(options({provider}) as ApiOptions).isReadyOrError;
      const {getKeyring, getHexPublicKey} = new PolkadotJs();

      const mnemonic = process.env.MYRIAD_FAUCET_MNEMONIC ?? '';
      const from = getKeyring().addFromMnemonic(mnemonic);
      const to = userId;

      const acalaDecimal = 12;
      const value = 10 * 10 ** acalaDecimal;

      const {nonce} = await api.query.system.account(from.address);
      const getNonce = await this.getQueueNumber(nonce.toJSON(), DefaultCurrencyType.AUSD);

      const transfer = api.tx.currencies.transfer(to, {Token: DefaultCurrencyType.AUSD}, value);
      const txHash = await transfer.signAndSend(from, {nonce: getNonce});

      const myriad = await this.userRepository.findOne({where: {id: getHexPublicKey(from)}});
      if (!myriad) await this.userRepository.create({id: getHexPublicKey(from), name: 'Myriad'});

      this.transactionRepository.create({
        hash: txHash.toString(),
        amount: value / 10 ** acalaDecimal,
        to: to,
        from: getHexPublicKey(from),
        currencyId: DefaultCurrencyType.AUSD,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
      }) as Promise<Transaction>;

      await api.disconnect();
    } catch {
      throw new HttpErrors.UnprocessableEntity('Rpc address not connected!');
    }
  }

  async sendMyriadReward(userId: string): Promise<void> {
    const {rpcURL: myriadRpc, decimal: myriadDecimal} = await this.currencyRepository.findById(
      DefaultCurrencyType.MYR,
    );

    const {polkadotApi, getKeyring, getHexPublicKey} = new PolkadotJs();
    const api = await polkadotApi(myriadRpc);

    const mnemonic = process.env.MYRIAD_FAUCET_MNEMONIC ?? '';
    const from = getKeyring().addFromMnemonic(mnemonic);
    const to = userId;

    const rewardAmount = +(process.env.MYRIAD_REWARD_AMOUNT ?? 0) * 10 ** myriadDecimal;

    const {nonce} = await api.query.system.account(from.address);
    const getNonce = await this.getQueueNumber(nonce.toJSON(), DefaultCurrencyType.MYR);

    const transfer = api.tx.balances.transfer(to, rewardAmount);
    const txHash = await transfer.signAndSend(from, {nonce: getNonce});

    const myriad = await this.userRepository.findOne({where: {id: getHexPublicKey(from)}});
    if (!myriad) await this.userRepository.create({id: getHexPublicKey(from), name: 'Myriad'});

    this.transactionRepository.create({
      hash: txHash.toString(),
      amount: rewardAmount / 10 ** myriadDecimal,
      to: to,
      from: getHexPublicKey(from),
      currencyId: DefaultCurrencyType.MYR,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
    }) as Promise<Transaction>;

    await api.disconnect();
  }

  async claimTips(userSocialMedia: UserSocialMedia): Promise<void> {
    const {userId, peopleId} = userSocialMedia;
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    const from = getKeyring().addFromUri('//' + peopleId);
    const to = userId;

    const userCurrencies = await this.userCurrencyRepository.find({
      where: {
        userId: userId,
        currencyId: {
          nlike: DefaultCurrencyType.MYR,
        },
      },
      include: ['currency'],
    });

    let api = null;
    let initRpcURL = null;

    for (const userCurrency of userCurrencies) {
      const {id, decimal, rpcURL, native} = userCurrency.currency;

      let balance = 0;

      try {
        if (!api || !initRpcURL) {
          const provider = new WsProvider(rpcURL);

          api = await new ApiPromise(
            options({
              provider,
            }) as ApiOptions,
          ).isReadyOrError;

          initRpcURL = rpcURL;
        }

        if (api && initRpcURL !== rpcURL) {
          await api.disconnect();

          const provider = new WsProvider(rpcURL);
          api = await new ApiPromise(
            options({
              provider,
            }) as ApiOptions,
          ).isReadyOrError;

          initRpcURL = rpcURL;
        }

        if (native) {
          const nativeBalance = await api.query.system.account(from.publicKey);

          balance = nativeBalance.data.free.toJSON();
        } else {
          const nonNativeBalance = await api.query.tokens.accounts(from.publicKey, {Token: id});
          const result = nonNativeBalance.toJSON() as unknown as Balance;

          balance = result.free;
        }

        if (!balance) continue;

        const paymentInfo = {
          amount: balance,
          to: to,
          from: from,
          currencyId: id as DefaultCurrencyType,
          decimal: decimal,
          native: native,
        };

        const txFee = await this.getTransactionFee(api, paymentInfo);

        if (balance - txFee < 0) continue;

        let transfer = null;

        if (native) transfer = api.tx.balances.transfer(to, balance - txFee);
        else transfer = api.tx.currencies.transfer(to, {Token: id}, balance - txFee);

        const txHash = await transfer.signAndSend(from);

        this.transactionRepository.create({
          hash: txHash.toString(),
          amount: balance / 10 ** decimal,
          to: to,
          from: getHexPublicKey(from),
          currencyId: id,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        }) as Promise<Transaction>;
      } catch (err) {
        // ignore
      }
    }
  }

  async getTransactionFee(blockchainApi: ApiPromise, paymentInfo: PaymentInfo): Promise<number> {
    const {amount, to, from, currencyId, decimal, native} = paymentInfo;
    let txFee = 0;

    if (native) {
      const {weight, partialFee} = await blockchainApi.tx.balances
        .transfer(to, Number(amount))
        .paymentInfo(from);

      txFee = Math.floor(+weight.toString() + +partialFee.toString());
    } else {
      const cryptoAcaPoolString = (
        await blockchainApi.query.dex.liquidityPool([{Token: 'ACA'}, {Token: currencyId}])
      ).toString();

      const cryptoAcaPool = cryptoAcaPoolString
        .substring(1, cryptoAcaPoolString.length - 1)
        .replace(/"/g, '')
        .split(',');

      const crypto = parseInt(cryptoAcaPool[1]) / 10 ** decimal;
      const aca = parseInt(cryptoAcaPool[0]) / 10 ** 13;
      const cryptoPerAca = crypto / aca;

      // Get transaction fee
      const {weight, partialFee} = await blockchainApi.tx.currencies
        .transfer(to, {Token: currencyId}, Number(amount))
        .paymentInfo(from);

      const txFeeInAca = (+weight.toString() + +partialFee.toString()) / 10 ** 13;

      txFee = Math.floor(txFeeInAca * cryptoPerAca * 10 ** decimal);
    }

    return txFee;
  }

  async getQueueNumber(nonce: number, type: DefaultCurrencyType): Promise<number> {
    const queue = await this.queueRepository.findOne({
      where: {
        id: type,
      },
    });

    let priority = nonce;

    if (!queue) {
      await this.queueRepository.create({
        id: type,
        priority: priority + 1,
      });
    } else {
      if (queue.priority >= priority) priority = queue.priority;
      else priority = nonce;
      await this.queueRepository.updateById(queue.id, {
        priority: priority + 1,
      });
    }

    return priority;
  }
}
