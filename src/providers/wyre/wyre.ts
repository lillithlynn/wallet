import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import env from '../../environments';
import {
  AvailableCoin,
  AvailableToken,
  SupportedCoinsAndTokens
} from '../../models/crypto/crypto.model';

// providers
import { CurrencyProvider } from '../currency/currency';
import { Logger } from '../logger/logger';
import { PersistenceProvider } from '../persistence/persistence';
import { RateProvider } from '../rate/rate';

const URI_DEV = 'https://api.testwyre.com';
const URI_PROD = 'https://api.sendwyre.com';

@Injectable()
export class WyreProvider {
  private env: string;
  private _supportedCoins: AvailableCoin[];
  private _supportedTokens: AvailableToken[];

  public uri: string;
  public supportedFiatAltCurrencies;
  public supportedCoinsAndTokens: SupportedCoinsAndTokens[];
  public supportedPaymentMethods;
  public fiatAmountLimits: { min: number; max: number };

  constructor(
    private http: HttpClient,
    private logger: Logger,
    private persistenceProvider: PersistenceProvider,
    private rateProvider: RateProvider,
    private currencyProvider: CurrencyProvider
  ) {
    this.env = env.name == 'development' ? 'sandbox' : 'production';
    this.logger.debug('WyreProvider initialized - env: ' + this.env);
    this.uri = env.name == 'development' ? URI_DEV : URI_PROD;
    this.supportedFiatAltCurrencies = ['AUD', 'CAD', 'EUR', 'GBP', 'USD'];
    this.supportedCoinsAndTokens = [];
    this._supportedCoins = [{ coin: 'btc' }, { coin: 'eth' }];
    _.each(this._supportedCoins, sc => {
      this.supportedCoinsAndTokens.push({
        name: this.currencyProvider.getCoinName(sc.coin),
        chain: this.currencyProvider.getChain(sc.coin),
        coin: sc.coin,
        isToken: false
      });
    });

    this._supportedTokens = [
      { symbol: 'usdc', chain: 'eth' },
      { symbol: 'gusd', chain: 'eth' },
      { symbol: 'pax', chain: 'eth' },
      { symbol: 'busd', chain: 'eth' },
      { symbol: 'dai', chain: 'eth' },
      { symbol: 'wbtc', chain: 'eth' }
    ];
    _.each(this._supportedTokens, sc => {
      this.supportedCoinsAndTokens.push({
        name: this.currencyProvider.getTokenName(sc.symbol),
        chain: this.currencyProvider.getChain(sc.chain),
        coin: sc.symbol,
        isToken: true
      });
    });

    this.fiatAmountLimits = {
      min: 50,
      max: 1000
    };
  }

  public getSupportedFiatAltCurrencies(): string[] {
    return this.supportedFiatAltCurrencies;
  }

  public getRates() {
    const url = this.uri + '/v3/rates';
    const headers = {
      'Content-Type': 'application/json'
    };

    // as: DIVISOR, MULTIPLIER, or PRICED
    const params = new HttpParams().set('as', 'PRICED');

    return new Promise((resolve, reject) => {
      this.http.get(url, { headers, params }).subscribe(
        data => {
          return resolve(data);
        },
        err => {
          return reject(err);
        }
      );
    });
  }

  public getCountries() {
    const url = this.uri + '/v3/widget/countries';
    const headers = {
      'Content-Type': 'application/json'
    };

    return new Promise((resolve, reject) => {
      this.http.get(url, { headers }).subscribe(
        data => {
          return resolve(data);
        },
        err => {
          return reject(err);
        }
      );
    });
  }

  public getFiatCurrencyLimits(
    fiatCurrency: string,
    coin: string,
    country?: string
  ) {
    let min, max: number;
    if (!country || country != 'US') {
      min = 50;
      max = 1000;
    } else {
      min = 50;
      max = 500;
    }
    this.fiatAmountLimits.min = this.calculateFiatRate(min, fiatCurrency, coin);
    this.fiatAmountLimits.max = this.calculateFiatRate(max, fiatCurrency, coin);

    return this.fiatAmountLimits;
  }

  private calculateFiatRate(
    amount: number,
    fiatCurrency: string,
    cryptoCurrency: string
  ): number {
    if (_.includes(['USD'], fiatCurrency)) {
      return amount;
    }
    const rateFromFiat = this.rateProvider.fromFiat(
      amount,
      'USD',
      cryptoCurrency
    );
    const coinDetails = _.find(
      this.currencyProvider.availableCoins,
      at => at.coin == cryptoCurrency.toLowerCase()
    );
    return +this.rateProvider
      .toFiat(
        rateFromFiat,
        fiatCurrency,
        cryptoCurrency,
        coinDetails.tokenInfo && coinDetails.tokenInfo.address
      )
      .toFixed(2);
  }

  public getLimits() {
    const url = this.uri + '/v3/limits';
    const headers = {
      'Content-Type': 'application/json'
    };

    return new Promise((resolve, reject) => {
      this.http.get(url, { headers }).subscribe(
        data => {
          return resolve(data);
        },
        err => {
          return reject(err);
        }
      );
    });
  }

  public walletOrderQuotation(wallet, data): Promise<any> {
    data.env = this.env;
    return wallet.wyreWalletOrderQuotation(data);
  }

  public walletOrderReservation(wallet, data): Promise<any> {
    data.env = this.env;
    return wallet.wyreWalletOrderReservation(data);
  }

  public getWyreUrlParams(wallet): Promise<any> {
    const data = {
      env: this.env
    };
    return wallet.wyreUrlParams(data);
  }

  public getWalletOrderDetails(orderId: string) {
    const url = this.uri + '/v3/orders/' + orderId;
    const headers = {
      'Content-Type': 'application/json'
    };

    return new Promise((resolve, reject) => {
      this.http.get(url, { headers }).subscribe(
        data => {
          return resolve(data);
        },
        err => {
          return reject(err);
        }
      );
    });
  }

  public getTransfer(transferId: string) {
    const url = this.uri + '/v2/transfer/' + transferId + '/track';
    const headers = {
      'Content-Type': 'application/json'
    };

    return new Promise((resolve, reject) => {
      this.http.get(url, { headers }).subscribe(
        data => {
          return resolve(data);
        },
        err => {
          return reject(err);
        }
      );
    });
  }

  public saveWyre(data, opts): Promise<any> {
    const env = this.env;
    data.created_on = Date.now();

    return this.persistenceProvider.getWyre(env).then(oldData => {
      if (_.isString(oldData)) {
        oldData = JSON.parse(oldData);
      }
      if (_.isString(data)) {
        data = JSON.parse(data);
      }
      let inv = oldData ? oldData : {};
      inv[data.orderId] = data;
      if (opts && (opts.error || opts.status)) {
        inv[data.orderId] = _.assign(inv[data.orderId], opts);
      }
      if (opts && opts.remove) {
        if (inv[data.transferId]) delete inv[data.transferId];
        if (inv[data.orderId]) delete inv[data.orderId];
      }

      inv = JSON.stringify(inv);

      this.persistenceProvider.setWyre(env, inv);
      return Promise.resolve();
    });
  }

  public getWyre(): Promise<any> {
    const env = this.env;
    return this.persistenceProvider.getWyre(env);
  }
}
