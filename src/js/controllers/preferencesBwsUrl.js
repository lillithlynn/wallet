'use strict';

angular.module('copayApp.controllers').controller('preferencesBwsUrlController',
  function($scope, $log, $stateParams, $ionicNavBarDelegate, configService, applicationService, profileService, storageService) {
    $ionicNavBarDelegate.title('Wallet Service URL');
    $scope.error = null;
    $scope.success = null;

    var wallet = profileService.getWallet($stateParams.walletId);
    var walletId = wallet.credentials.walletId;
    var defaults = configService.getDefaults();
    var config = configService.getSync();

    $scope.bwsurl = (config.bwsFor && config.bwsFor[walletId]) || defaults.bws.url;

    $scope.resetDefaultUrl = function() {
      $scope.bwsurl = defaults.bws.url;
    };

    $scope.save = function() {

      var bws;
      switch ($scope.bwsurl) {
        case 'prod':
        case 'production':
          bws = 'https://bws.bitpay.com/bws/api'
          break;
        case 'sta':
        case 'staging':
          bws = 'https://bws-staging.b-pay.net/bws/api'
          break;
        case 'loc':
        case 'local':
          bws = 'http://localhost:3232/bws/api'
          break;
      };
      if (bws) {
        $log.info('Using BWS URL Alias to ' + bws);
        $scope.bwsurl = bws;
      }

      var opts = {
        bwsFor: {}
      };
      opts.bwsFor[walletId] = $scope.bwsurl;

      configService.set(opts, function(err) {
        if (err) $log.debug(err);
        storageService.setCleanAndScanAddresses(walletId, function() {
          applicationService.restart();
        });
      });
    };
  });
