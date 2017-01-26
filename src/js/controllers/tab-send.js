'use strict';

angular.module('copayApp.controllers').controller('tabSendController', function($scope, $rootScope, $log, $timeout, $ionicScrollDelegate, addressbookService, profileService, lodash, $state, walletService, incomingData, popupService, platformInfo, bwcError, gettextCatalog) {

  var originalList;
  var CONTACTS_SHOW_LIMIT;
  var currentContactsPage;
  $scope.isChromeApp = platformInfo.isChromeApp;

  var updateList = function() {
    CONTACTS_SHOW_LIMIT = 10;
    currentContactsPage = 0;
    originalList = [];

    $scope.wallets = profileService.getWallets({
      onlyComplete: true
    });

    $scope.hasWallets = lodash.isEmpty($scope.wallets) ? false : true;
    var networkResult = lodash.countBy($scope.wallets, 'network');

    $scope.showTransferCard = $scope.hasWallets && (networkResult.livenet > 1 || networkResult.testnet > 1);

    if (!$scope.showTransferCard) {
      lodash.each($scope.wallets, function(v) {
        originalList.push({
          color: v.color,
          name: v.name,
          isWallet: true,
          getAddress: function(cb) {
            walletService.getAddress(v, false, cb);
          },
        });
      });
    }

    addressbookService.list(function(err, ab) {
      if (err) $log.error(err);

      $scope.hasContacts = lodash.isEmpty(ab) ? false : true;
      var completeContacts = [];
      lodash.each(ab, function(v, k) {
        completeContacts.push({
          name: lodash.isObject(v) ? v.name : v,
          address: k,
          email: lodash.isObject(v) ? v.email : null,
          getAddress: function(cb) {
            return cb(null, k);
          },
        });
      });

      var contacts = completeContacts.slice(0, (currentContactsPage + 1) * CONTACTS_SHOW_LIMIT);
      $scope.contactsShowMore = completeContacts.length > contacts.length;
      originalList = originalList.concat(contacts);
      $scope.list = lodash.clone(originalList);

      $timeout(function() {
        $ionicScrollDelegate.resize();
        $scope.$apply();
      }, 10);
    });
  };

  $scope.openScanner = function() {
    $state.go('tabs.scan');
  };

  $scope.showMore = function() {
    currentContactsPage++;
    updateList();
  };

  $scope.findContact = function(search) {

    if (incomingData.redir(search)) {
      return;
    }

    if (!search || search.length < 2) {
      $scope.list = originalList;
      $timeout(function() {
        $scope.$apply();
      });
      return;
    }

    var result = lodash.filter(originalList, function(item) {
      var val = item.name;
      return lodash.includes(val.toLowerCase(), search.toLowerCase());
    });

    $scope.list = result;
  };

  $scope.goToAmount = function(item) {
    $timeout(function() {
      item.getAddress(function(err, addr) {
        if (err || !addr) {
          //Error is already formated
          return popupService.showAlert(err);
        }
        $log.debug('Got toAddress:' + addr + ' | ' + item.name);
        return $state.transitionTo('tabs.send.amount', {
          isWallet: item.isWallet,
          toAddress: addr,
          toName: item.name,
          toEmail: item.email,
          toColor: item.color
        })
      });
    });
  };


  // THIS is ONLY to show the 'buy bitcoins' message
  // does not has any other function.

  var updateHasFunds = function() {

    if ($rootScope.everHasFunds) {
      $scope.hasFunds = true;
      return;
    }

    $scope.hasFunds = false;

    if (!$scope.wallets || $scope.wallets.length == 0) {
      $timeout(function() {
        $scope.$apply();
      });
      return;
    }

    $scope.checkingBalance = true;
    var index = 0;
    lodash.each($scope.wallets, function(w) {
      walletService.getStatus(w, {}, function(err, status) {

        ++index;
        if (err && !status) {
          $log.error(err);
          // error updating the wallet. Probably a network error, do not show
          // the 'buy bitcoins' message.

          $scope.hasFunds = true;
        } else if (status.availableBalanceSat > 0) {
          $scope.hasFunds = true;
          $rootScope.everHasFunds = true;
        }

        if (index == $scope.wallets.length) {
          if ($scope.hasFunds != true) {
            $ionicScrollDelegate.freezeScroll(true);
          }
          $scope.checkingBalance = false;
          $timeout(function() {
            $scope.$apply();
          });
        }
      });
    });
  };

  $scope.$on("$ionicView.beforeEnter", function(event, data) {
    $scope.formData = {
      search: null
    };
    updateList();
    updateHasFunds();
  });

  // This could probably be enhanced refactoring the routes abstract states
  $scope.createWallet = function() {
    $state.go('tabs.home').then(function() {
      $state.go('tabs.add.create-personal');
    });
  };

  $scope.buyBitcoin = function() {
    $state.go('tabs.home').then(function() {
      $state.go('tabs.buyandsell.glidera');
    });
  };

});
