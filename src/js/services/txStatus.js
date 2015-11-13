'use strict';

angular.module('copayApp.services').factory('txStatus', function($rootScope, $modal, lodash, profileService, $timeout, animationService) {
  var root = {};

  root.notify = function(txp, cb) {
    var fc = profileService.focusedClient;
    var status = txp.status;
    var type;
    var INMEDIATE_SECS = 10;

    if (status == 'broadcasted') {
      type = 'broadcasted';
    } else {

      var n = txp.actions.length;
      var action = lodash.find(txp.actions, {
        copayerId: fc.credentials.copayerId
      });

      if (!action)  {
        type = 'created';
      } else if (action.type == 'accept') {
        // created and accepted at the same time?
        if ( n == 1 && action.createdOn - txp.createdOn < INMEDIATE_SECS ) {
          type = 'created';
        } else {
          type = 'accepted';
        }
      } else if (action.type == 'reject') {
        type = 'rejected';
      } else {
        throw new Error('Unknown type:' + type);
      }
    }

    openModal(type, txp, cb);
  };

  root._templateUrl = function(type, txp) {
    return 'views/modals/tx-status.html';
  };

  var openModal = function(type, txp, cb) {
    $rootScope.modalOpened = true;
    var ModalInstanceCtrl = function($scope, $modalInstance) {
      var stop;
      $scope.timer = 4;
      $scope.type = type;

      $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
      };

      $scope.countdown = function() {
        stop = $timeout(function() {
          console.log($scope.timer);
          if ($scope.timer == 1) {
            $timeout.cancel(stop);
            $modalInstance.dismiss('cancel');
          } else {
            $scope.timer--;
            $scope.countdown();
          }
        }, 1000);
      };
      
      if (cb) $timeout(cb, 100);
    };
    var modalInstance = $modal.open({
      templateUrl: root._templateUrl(type, txp),
      windowClass: 'popup-tx-status',
      controller: ModalInstanceCtrl,
    });

    var disableCloseModal = $rootScope.$on('closeModal', function() {
      modalInstance.dismiss('cancel');
    });

    modalInstance.result.finally(function() {
      $rootScope.modalOpened = false;
      disableCloseModal();
    });
  };

  return root;
});
