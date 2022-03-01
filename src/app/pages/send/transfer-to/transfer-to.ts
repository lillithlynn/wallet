import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';

import * as _ from 'lodash';
import { EventManagerService } from 'src/app/providers/event-manager.service';
import { OnGoingProcessProvider } from 'src/app/providers/on-going-process/on-going-process';

// Providers
import { AddressBookProvider } from '../../../providers/address-book/address-book';
import {
  Coin,
  CoinsMap,
  CurrencyProvider
} from '../../../providers/currency/currency';
import { Logger } from '../../../providers/logger/logger';
import { PlatformProvider } from '../../../providers/platform/platform';
import { PopupProvider } from '../../../providers/popup/popup';
import { ProfileProvider } from '../../../providers/profile/profile';
import { WalletProvider } from '../../../providers/wallet/wallet';

// Pages
import { AmountPage } from '../amount/amount';
import { ConfirmPage } from '../confirm/confirm';

import { Location } from '@angular/common';


export interface FlatWallet {
  walletId: string;
  color: string;
  name: string;
  lastKnownBalance: string;
  cachedStatus: any;
  recipientType: 'wallet';
  coin: Coin;
  network: 'testnet' | 'livenet';
  m: number;
  n: number;
  needsBackup: boolean;
  keyId: string;
  walletGroupName: string;
  isComplete: () => boolean;
  getAddress: () => Promise<string>;
}

@Component({
  selector: 'page-transfer-to',
  templateUrl: 'transfer-to.html',
  styleUrls: ['transfer-to.scss']
})
export class TransferToPage {
  public search: string = '';
  public wallets = {} as CoinsMap<any>;
  public hasWallets = {} as CoinsMap<boolean>;
  public walletList = {} as CoinsMap<FlatWallet[]>;
  public availableCoins: Coin[];
  public contactsList = [];
  public filteredContactsList = [];
  public filteredWallets = [];
  public walletsByKeys = [];
  public filteredWalletsByKeys = [];
  public hasContacts: boolean;
  public contactsShowMore: boolean;
  public amount: string;
  public fiatAmount: number;
  public fiatCode: string;
  public _wallet: any = {};
  public _useAsModal: boolean;
  public _fromWalletDetails: boolean;
  public hasContactsOrWallets: boolean;
  public updatingContactsList: boolean = false;
  public itemTapped: boolean = false;

  private _delayTimeOut: number = 700;
  private _fromSelectInputs: boolean;
  private _fromMultiSend: boolean;

  private CONTACTS_SHOW_LIMIT: number = 10;
  private currentContactsPage: number = 0;
  navParamsData;

  constructor(
    private currencyProvider: CurrencyProvider,
    private router: Router,
    private profileProvider: ProfileProvider,
    private walletProvider: WalletProvider,
    private addressBookProvider: AddressBookProvider,
    private logger: Logger,
    private platformProvider: PlatformProvider,
    private popupProvider: PopupProvider,
    private viewCtrl: ModalController,
    private events: EventManagerService,
    private onGoingProcessProvider: OnGoingProcessProvider,
    private location: Location
  ) {
    if (this.router.getCurrentNavigation()) {
      this.navParamsData = this.router.getCurrentNavigation().extras.state;
    } else {
      this.navParamsData =  history ? history.state : undefined;
    }
    this.availableCoins = this.currencyProvider.getAvailableCoins();
    for (const coin of this.availableCoins) {
      this.wallets[coin] = this.profileProvider.getWallets({ coin });
      this.hasWallets[coin] = !_.isEmpty(this.wallets[coin]);
    }
    this._delayTimeOut =
      this.platformProvider.isIOS || this.platformProvider.isAndroid
        ? 700
        : 100;
  }

  @Input()
  set wallet(wallet) {
    this._wallet = this.navParamsData.wallet
      ? this.navParamsData.wallet
      : wallet;

    for (const coin of this.availableCoins) {
      this.walletList[coin] = _.compact(this.getWalletsList(coin));
    }
    if (this._wallet.donationCoin) {
      this.walletsByKeys = _.values(
        _.groupBy(this.walletList[this._wallet.donationCoin], 'keyId')
      );
    } else {
      this.walletsByKeys = _.values(
        _.groupBy(this.walletList[this._wallet.coin], 'keyId')
      );
    }

    this.delayUpdateContactsList(this._delayTimeOut);
  }

  get wallet() {
    return this._wallet;
  }

  @Input()
  set searchInput(search) {
    this.search = search;
    this.processInput();
  }

  get searchInput() {
    return this.search;
  }

  @Input()
  set useAsModal(useAsModal: boolean) {
    this._useAsModal = useAsModal;
  }

  get useAsModal() {
    return this._useAsModal;
  }

  @Input() dataDonation?: any;


  @Input()
  set fromWalletDetails(fromWalletDetails: boolean) {
    this._fromWalletDetails = fromWalletDetails;
  }

  get fromWalletDetails() {
    return this._fromWalletDetails;
  }

  @Input()
  set fromSelectInputs(fromSelectInputs: boolean) {
    this._fromSelectInputs = fromSelectInputs;
  }

  get fromSelectInputs() {
    return this._fromSelectInputs;
  }

  @Input()
  set fromMultiSend(fromMultiSend: boolean) {
    this._fromMultiSend = fromMultiSend;
  }

  get fromMultiSend() {
    return this._fromMultiSend;
  }

  public getCoinName(coin: Coin) {
    return this.currencyProvider.getCoinName(coin);
  }

  private getWalletsList(coin: string): FlatWallet[] {
    return this.hasWallets[coin]
      ? this.getRelevantWallets(this.wallets[coin])
      : [];
  }

  private getRelevantWallets(rawWallets): FlatWallet[] {
    return rawWallets
      .map(wallet => this.flattenWallet(wallet))
      .filter(wallet => this.filterIrrelevantRecipients(wallet));
  }

  delayUpdateContactsList(delayTime: number = 700) {
    if (this.updatingContactsList) return;
    this.updatingContactsList = true;
    setTimeout(() => {
      this.updateContactsList();
      this.updatingContactsList = false;
    }, delayTime || 700);
  }

  private updateContactsList(): void {
    this.addressBookProvider
      .list(this._wallet ? this._wallet.network : null)
      .then(ab => {
        this.hasContacts = _.isEmpty(ab) ? false : true;
        if (!this.hasContacts) return;

        let contactsList = [];
        _.each(ab, c => {
          contactsList.push({
            name: c.name,
            address: c.address,
            network: c.network,
            email: c.email,
            recipientType: 'contact',
            coin: c.coin,
            getAddress: () => Promise.resolve(c.address),
            destinationTag: c.tag
          });
        });
        contactsList = _.orderBy(contactsList, 'name');
        this.contactsList = contactsList.filter(c =>
          this.filterIrrelevantRecipients(c)
        );
        let shortContactsList = _.clone(
          this.contactsList.slice(
            0,
            (this.currentContactsPage + 1) * this.CONTACTS_SHOW_LIMIT
          )
        );
        this.filteredContactsList = _.clone(shortContactsList);
        this.contactsShowMore =
          this.contactsList.length > shortContactsList.length;
      });
  }

  private flattenWallet(wallet): FlatWallet {
    return {
      walletId: wallet.credentials.walletId,
      color: wallet.color,
      name: wallet.name,
      lastKnownBalance: wallet.lastKnownBalance,
      cachedStatus: wallet.cachedStatus,
      recipientType: 'wallet',
      coin: wallet.coin,
      network: wallet.network,
      m: wallet.credentials.m,
      n: wallet.credentials.n,
      keyId: wallet.keyId,
      walletGroupName: wallet.walletGroupName,
      isComplete: () => wallet.isComplete(),
      needsBackup: wallet.needsBackup,
      getAddress: () => this.walletProvider.getAddress(wallet, false)
    };
  }

  private filterIrrelevantRecipients(recipient: {
    coin: string;
    network: string;
    walletId: string;
  }): boolean {
    if (this._wallet.donationCoin) {
      return this._wallet
        ? this._wallet.donationCoin === recipient.coin &&
        this._wallet.id !== recipient.walletId
        : true;
    }
    return this._wallet
      ? this._wallet.coin === recipient.coin &&
      this._wallet.network === recipient.network &&
      this._wallet.id !== recipient.walletId
      : true;
  }

  public showMore(): void {
    this.currentContactsPage++;
    this.updateContactsList();
  }

  public processInput(): void {
    if (this.search && this.search.trim() != '') {
      this.searchWallets();
      this.searchContacts();

      this.hasContactsOrWallets =
        this.filteredContactsList.length === 0 &&
          this.filteredWallets.length === 0
          ? false
          : true;
    } else {
      this.delayUpdateContactsList(this._delayTimeOut);
      this.filteredWallets = [];
      this.filteredWalletsByKeys = [];
    }
  }

  public searchWallets(): void {
    for (const coin of this.availableCoins) {
      if (this.hasWallets[coin] && this._wallet.coin === coin) {
        this.filteredWallets = this.walletList[coin].filter(wallet => {
          return _.includes(
            wallet.name.toLowerCase(),
            this.search.toLowerCase()
          );
        });
        this.filteredWalletsByKeys = _.values(
          _.groupBy(this.filteredWallets, 'keyId')
        );
      }
    }
  }

  public searchContacts(): void {
    this.filteredContactsList = _.filter(this.contactsList, item => {
      let val = item.name;
      return _.includes(val.toLowerCase(), this.search.toLowerCase());
    });
  }

  public close(item): void {
    this.onGoingProcessProvider.set('Please wait...')
    this.itemTapped = true;
    item
      .getAddress()
      .then((addr: string) => {
        if (!addr) {
          // Error is already formated
          this.popupProvider.ionicAlert('Error - no address');
          return;
        }
        this.logger.debug('Got address:' + addr + ' | ' + item.name);

        if (this._fromSelectInputs) {
          const recipient = {
            recipientType: item.recipientType,
            toAddress: addr,
            name: item.name,
            email: item.email
          };
          this.router.navigate(['/select-inputs']).then(data=>{
            this.viewCtrl.dismiss();
            this.events.publish('addRecipient', recipient);
          })

        } else if (this.dataDonation && this.dataDonation.isDonation) {
          this.dataDonation.receiveLotusAddress = addr;
          this.dataDonation.nameReceiveLotusAddress = item.name;
          this.router.navigate(['/confirm'], //ConfirmPage
            { state: this.dataDonation });
        }
        else if(this.navParamsData.fromSend){
          const recipient = {
            recipientType: item.recipientType,
            toAddress: addr,
            name: item.name,
            email: item.email,
            id: this.navParamsData.recipientId
          };
          this.location.historyGo(-1);
          this.events.publish('addRecipient', recipient);

          // // this.router.navigate(['/send-page']).then(data=>{
          // //   this.viewCtrl.dismiss();
          // //   this.events.publish('addRecipient', recipient);
          // })
        }
        else {
          this.router.navigate(['/amount'], {
            state: {
              walletId: this._wallet.id,
              recipientType: item.recipientType,
              amount: parseInt(this._wallet.amount, 10),
              toAddress: addr,
              name: item.name,
              email: item.email,
              color: item.color,
              coin: item.coin,
              network: item.network,
              useAsModal: this._useAsModal,
              fromWalletDetails: this._fromWalletDetails,
              fromMultiSend: this._fromMultiSend,
              destinationTag: item.destinationTag
            }
          });
        }
        this.onGoingProcessProvider.clear();
      })
      .catch(err => {
        this.logger.error('Send: could not getAddress', err);
        this.onGoingProcessProvider.clear();
      });
    this.itemTapped = false;
  }
}
