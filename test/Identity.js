'use strict';


var _ = require('underscore');
var chai = chai || require('chai');
var sinon = sinon || require('sinon');
var should = chai.should();
var PluginManager = require('../js/models/PluginManager');
var Insight = require('../js/models/Insight');

var Identity = copay.Identity;
var Wallet = copay.Wallet;
var Passphrase = copay.Passphrase;

var FakeBlockchain = require('./mocks/FakeBlockchain');

var PERSISTED_PROPERTIES = (copay.Wallet || require('../js/models/Wallet')).PERSISTED_PROPERTIES;

function assertObjectEqual(a, b) {
  PERSISTED_PROPERTIES.forEach(function(k) {
    if (a[k] && b[k]) {
      _.omit(a[k], 'name').should.be.deep.equal(b[k], k + ' differs');
    }
  })
}


describe.only('Identity model', function() {
  var wallet;
  var email = 'hola@hola.com';
  var password = 'password';
  var blockchain;

  var config = {
    walletDefaults: {
      requiredCopayers: 3,
      totalCopayers: 5,
      spendUnconfirmed: 1,
      reconnectDelay: 100,

    },
    blockchain: {
      host: 'test.insight.is',
      port: 80,
      schema: 'https'
    },
    networkName: 'testnet',
    passphrase: {
      iterations: 100,
      storageSalt: 'mjuBtGybi/4=',
    },

    // network layer config
    network: {
      testnet: {
        url: 'https://test-insight.bitpay.com:443'
      },
      livenet: {
        url: 'https://insight.bitpay.com:443'
      },
    },
    version: '0.0.1'
  };

  function getDefaultParams() {
    var params = _.clone(config);
    _.extend(params, {
      email: email,
      password: password
    });
    params.storage = sinon.stub();
    params.storage.setCredentials = sinon.stub();
    params.storage.getItem = sinon.stub();
    params.storage.setItem = sinon.stub();
    params.storage.setItem.onFirstCall().callsArgWith(2, null);
    params.storage.setItem.onSecondCall().callsArgWith(2, null);
    return params;
  }

  function getNewWallet() {
    var wallet = sinon.stub();
    wallet.on = sinon.stub().yields(null);
    wallet.netStart = sinon.stub();
    wallet.toObj = sinon.stub();
    wallet.getName = sinon.stub().returns('walletname');
    wallet.getId = sinon.stub().returns('wid:123');
    return wallet;
  }

  function createIdentity(done) {
    console.error("Reseting");

    // TODO (eordano): Change this to proper dependency injection
    blockchain = new FakeBlockchain(config.blockchain);
    blockchain.on = sinon.stub();
    Wallet._newInsight = sinon.stub().returns(blockchain);

    wallet = getNewWallet();
    Identity._newWallet = sinon.stub().returns(wallet);

    params = getDefaultParams();
    Identity.create(params, done);
    return {
      blockchain: blockchain,
      storage: params.storage,
      wallet: wallet,
      params: params
    };
  };

  describe('new Identity()', function() {
    it('returns an identity', function() {
      var iden = new Identity(getDefaultParams());
      should.exist(iden);
      iden.walletDefaults.should.deep.equal(config.walletDefaults);
    });
  });

  describe('Identity.create()', function() {
    it('should call .store', function(done) {
      blockchain.on = sinon.spy();
      Identity.create(getDefaultParams(), function(err, iden) {
        should.not.exist(err);
        should.exist(iden.wallets);
        done();
      });
    });
  });

  describe('#open', function(done) {

    it('should return last focused wallet', function(done) {
      var wallets = [{
        id: 'wallet1',
        store: sinon.stub().yields(null),
        netStart: sinon.stub(),
      }, {
        id: 'wallet2',
        store: sinon.stub().yields(null),
        netStart: sinon.stub(),
      }, {
        id: 'wallet3',
        store: sinon.stub().yields(null),
        netStart: sinon.stub(),
      }];
      createIdentity(function(identity) {
      });
      .getLastFocusedWallet = sinon.stub().returns(wallets[1]);
      Identity._walletRead = sinon.stub();
      Identity._walletRead.onCall(0).callsArgWith(2, null, wallets[0]);
      Identity._walletRead.onCall(1).callsArgWith(2, null, wallets[1]);
      Identity._walletRead.onCall(2).callsArgWith(2, null, wallets[2]);

      Identity.open(email, password, config, function(err, iden, w) {
        w.id.should.equal('wallet2');
        done();
      });
    });
  });

  describe('#store', function() {

    it('should call .store from profile and no wallets', function(done) {
      profile.store = sinon.stub().yields(null);
      iden.wallets = [];
      iden.store({}, function(err) {
        should.not.exist(err);
        profile.store.calledOnce.should.equal(true);
        done();
      });
    });

    it('should call .store from profile and wallets (2)', function(done) {
      iden.profile.store = sinon.stub().yields(null);
      iden.openWallets = [{
        store: sinon.stub().yields(null)
      }, {
        store: sinon.stub().yields(null)
      }];
      iden.store({}, function(err) {
        should.not.exist(err);
        iden.profile.store.calledOnce.should.equal(true);
        iden.openWallets[0].store.calledOnce.should.equal(true);
        iden.openWallets[1].store.calledOnce.should.equal(true);
        done();
      });
    });
  });

  describe('#createWallet', function() {
    it('should create wallet', function(done) {
      iden.createWallet(null, function(err, w) {
        should.exist(w);
        should.not.exist(err);
        done();
      });
    });

    it('should add wallet to profile', function(done) {
      iden.createWallet(null, function(err, w) {
        profile.addWallet.getCall(0).args[0].should.contain('wid:123');
        done();
      });
    });


    it('should be able to create wallets with given pk', function(done) {
      var priv = 'tprv8ZgxMBicQKsPdEqHcA7RjJTayxA3gSSqeRTttS1JjVbgmNDZdSk9EHZK5pc52GY5xFmwcakmUeKWUDzGoMLGAhrfr5b3MovMUZUTPqisL2m';
      iden.createWallet({
        privateKeyHex: priv,
      }, function(err, w) {
        Identity._newWallet.getCall(1).args[0].privateKey.toObj().extendedPrivateKeyString.should.equal(priv);
        should.not.exist(err);
        done();
      });
    });

    it('should be able to create wallets with random pk', function(done) {
      iden.createWallet(null, function(err, w1) {
        iden.createWallet(null, function(err, w2) {
          Identity._newWallet.getCall(0).args[0].privateKey.toObj().extendedPrivateKeyString.should.not.equal(
            Identity._newWallet.getCall(1).args[0].privateKey.toObj().extendedPrivateKeyString
          );
          done();
        });
      });
    });
  });


  describe('#deleteWallet', function() {
    it('should call profile and wallet', function(done) {
      iden.createWallet(null, function(err, w) {
        iden.deleteWallet(w.id, function(err) {
          should.not.exist(err);
          done();
        });
      });
    });
  });


  describe('#openWallet', function() {

    beforeEach(function() {
      iden.migrateWallet = sinon.stub().yields(null);
      storage.setPassword = sinon.spy();
      storage.getFirst = sinon.stub().yields(null, 'wallet1234');

      var wallet = sinon.stub();
      wallet.netStart = sinon.stub();
      wallet.store = sinon.stub().yields(null);

      Identity._walletRead = sinon.stub().callsArgWith(2, null, wallet);
    });

    it('should return wallet and call .store & .migrateWallet', function(done) {

      iden.openWallet('dummy', function(err, w) {
        should.not.exist(err);
        w.store.calledOnce.should.equal(true);
        // iden.migrateWallet.calledOnce.should.equal(true);
        done();
      });
    });
  });



  describe('#importWallet', function() {

    beforeEach(function() {
      iden.migrateWallet = sinon.stub().yields(null);
      storage.getFirst = sinon.stub().yields(null, 'wallet1234');
    });

    it('should create wallet from encrypted object', function(done) {
      iden.storage.setPassphrase = sinon.spy();
      iden.storage.decrypt = sinon.stub().withArgs('base64').returns({
        networkName: 'testnet'
      });

      wallet.getId = sinon.stub().returns('ID123');
      Identity._walletFromObj = sinon.stub().returns(wallet);
      Identity._walletRead = sinon.stub().yields(null, wallet);

      iden.importWallet("encrypted object", "xxx", [], function(err) {
        iden.openWallet('ID123', function(err, w) {
          should.not.exist(err);
          should.exist(w);
          done();
        });
      });
    });
  });

  describe('#listWallets', function() {
    it('should return empty array if no wallets', function() {
      iden.listWallets();
      iden.profile.listWallets.calledOnce.should.equal(true);
    });
  });


  describe('#deleteWallet', function() {
    Identity._walletDelete = sinon.stub().callsArgWith(2, null);

    it('should call Profile deleteWallet', function(done) {
      iden.profile.deleteWallet = sinon.stub().yields(null);
      iden.deleteWallet('xxx', function() {
        iden.profile.deleteWallet.getCall(0).args[0].should.equal('xxx');
        done();
      });
    });
  });


  describe('#export', function() {

    beforeEach(function() {
      var ws = [];
      _.each([0, 1, 2, 3, 4], function(i) {
        var w = sinon.stub();
        w.export = sinon.stub().returns('enc' + i);
        w.getId = sinon.stub().returns('wid' + i);
        ws.push(w);
      });
      iden.openWallets = ws;
      iden.profile.export = sinon.stub().returns('penc');
      iden.storage.iterations = 13;
    });

    it('should create an encrypted object', function() {
      var ret = JSON.parse(iden.exportAsJson());
      ret.iterations.should.equal(13);
      ret.profile.should.equal('penc');
      _.each([0, 1, 2, 3, 4], function(i) {
        ret.wallets['wid' + i].should.equal('enc' + i);
      });
    });
  });

  describe('#import', function() {

    beforeEach(function() {
      var ws = [];
      _.each([0, 1, 2, 3, 4], function(i) {
        var w = sinon.stub();
        w.export = sinon.stub().returns('enc' + i);
        w.getId = sinon.stub().returns('wid' + i);
        ws.push(w);
      });
      iden.openWallets = ws;
      iden.profile.export = sinon.stub().returns('penc');
      iden.storage.iterations = 13;
      iden.storage.decrypt = sinon.stub().returns({
        email: '1@1.com',
        hash: 'hash1234'
      });

    });


    it('should check the import string', function(done) {
      Identity.importFromJson(JSON.stringify({
        profile: '1234'
      }), '1234', config, function(err, ret) {
        err.should.contain('BADSTR');
        done();
      });
    });


    it('should check the import string 2', function(done) {
      Identity.importFromJson(JSON.stringify({
        iterations: 10,
      }), '1234', config, function(err, ret) {
        err.should.contain('BADSTR');
        done();
      });
    });

    it('should import a simple wallet', function(done) {
      Identity.importFromJson(JSON.stringify({
        iterations: 10,
        profile: '1234'
      }), '1234', config, function(err, iden) {
        should.not.exist(err);
        should.exist(iden);
        iden.profile.email.should.equal('1@1.com');
        done();
      });
    });
  });

  /**
   * TODO (eordano): Move this to a different test file
   *
  describe('#pluginManager', function() {
    it('should create a new PluginManager object', function() {
      var pm = new PluginManager({plugins: { FakeLocalStorage: true }, pluginsPath: '../../test/mocks/'});
      should.exist(pm);
    });
  });

  describe('#Insight', function() {
    it('should parse a uri', function() {
      var uri = Insight.setCompleteUrl('http://someurl.bitpay.com:443');
      should.exist(uri);
    });
  });
   */

  describe('#joinWallet', function() {
    var opts = {
      secret: '8WtTuiFTkhP5ao7AF2QErSwV39Cbur6pdMebKzQXFqL59RscXM',
      nickname: 'test',
      password: 'pass'
    };

    it('should yield bad network error', function(done) {
      var net = sinon.stub();

      net.greet = sinon.stub();
      net.cleanUp = sinon.stub();
      net.start = sinon.stub().yields(null);
      net.on = sinon.stub();
      net.on.withArgs('data').yields('senderId', {
        type: 'walletId',
        networkName: 'aWeirdNetworkName',
        opts: {},
      });
      Identity._newAsync = function() {
        return net;
      };

      opts.privHex = undefined;
      iden.joinWallet(opts, function(err, w) {
        err.should.equal('badNetwork');
        done();
      });
    });


    it('should yield to join error', function(done) {
      opts.privHex = undefined;
      var net = sinon.stub();
      net.greet = sinon.stub();
      net.cleanUp = sinon.stub();
      net.start = sinon.stub().yields(null);

      net.on = sinon.stub();
      net.on.withArgs('serverError').yields(null);
      net.on.withArgs('data').yields('senderId', {
        type: 'walletId',
        networkName: iden.networkName,
      });
      Identity._newAsync = function() {
        return net;
      };

      iden.joinWallet(opts, function(err, w) {
        err.should.equal('joinError');
        done();
      });
    });


    it('should call network.start / create', function(done) {
      opts.privHex = undefined;
      var net = sinon.stub();
      net.cleanUp = sinon.spy();
      net.greet = sinon.spy();
      net.start = sinon.stub().yields(null);

      net.on = sinon.stub();
      net.on.withArgs('connected').yields(null);
      net.on.withArgs('data').yields('senderId', {
        type: 'walletId',
        networkName: 'testnet',
        opts: {},
      });
      Identity._newAsync = function() {
        return net;
      };

      var w = sinon.stub();
      w.sendWalletReady = sinon.spy();
      iden.createWallet = sinon.stub().yields(null, w);
      iden.joinWallet(opts, function(err, w) {
        net.start.calledOnce.should.equal(true);
        iden.createWallet.calledOnce.should.equal(true);
        iden.createWallet.calledOnce.should.equal(true);

        w.sendWalletReady.calledOnce.should.equal(true);
        w.sendWalletReady.getCall(0).args[0].should.equal('03ddbc4711534bc62ccf576ab05f2a0afd11f9e2f4016781f3f5a88de9543a229a');
        done();
      });
    });

    it('should return walletFull', function(done) {
      opts.privHex = undefined;
      var net = sinon.stub();
      net.cleanUp = sinon.spy();
      net.greet = sinon.spy();
      net.start = sinon.stub().yields(null);

      net.on = sinon.stub();
      net.on.withArgs('connected').yields(null);
      net.on.withArgs('data').yields('senderId', {
        type: 'walletId',
        networkName: 'testnet',
        opts: {},
      });
      Identity._newAsync = function() {
        return net;
      };
      iden.createWallet = sinon.stub().yields(null, null);
      iden.joinWallet(opts, function(err, w) {
        err.should.equal('walletFull');
        done();
      });
    });

    it('should accept a priv key a input', function() {
      opts.privHex = 'tprv8ZgxMBicQKsPf7MCvCjnhnr4uiR2Z2gyNC27vgd9KUu98F9mM1tbaRrWMyddVju36GxLbeyntuSadBAttriwGGMWUkRgVmUUCg5nFioGZsd';
      var net = sinon.stub();
      Identity._newAsync = function() {
        return net;
      };
      net.on = sinon.stub();

      net.cleanUp = sinon.spy();
      net.start = sinon.spy();
      iden.joinWallet(opts, function(err, w) {
        net.start.getCall(0).args[0].privkey.should.equal('ddc2fa8c583a73c4b2a24630ec7c283df4e7c230a02c4e48bc36ec61687afd7d');
      });
    });
    it('should call network.start with private key', function() {
      opts.privHex = undefined;
      var net = sinon.stub();
      net.cleanUp = sinon.spy();
      net.on = sinon.stub();
      net.start = sinon.spy();
      Identity._newAsync = function() {
        return net;
      };
      iden.joinWallet(opts, function(err, w) {
        net.start.getCall(0).args[0].privkey.length.should.equal(64); //privkey is hex of private key buffer
      });
    });
  });
});
