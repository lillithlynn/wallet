'use strict';
var bitcore = require('bitcore');
var preconditions = require('preconditions').singleton();

angular.module('copayApp.controllers').controller('SendController',
  function($scope, $rootScope, $window, $timeout, $modal, $filter, $location, isMobile, notification, rateService) {

    var satToUnit, unitToSat, w;

    $scope.init = function() {
      w = $rootScope.wallet;
      preconditions.checkState(w);
      preconditions.checkState(w.settings.unitToSatoshi);

      $rootScope.title = w.isShared() ? 'Create Transaction Proposal' : 'Send';
      $scope.loading = false;
      $scope.error = $scope.success = null;

      unitToSat = w.settings.unitToSatoshi;
      satToUnit = 1 / w.settings.unitToSatoshi;

      $scope.alternativeName = w.settings.alternativeName;
      $scope.alternativeIsoCode = w.settings.alternativeIsoCode;

      $scope.isRateAvailable = false;
      $scope.rateService = rateService;
      $scope.showScanner = false;
      $scope.myId = w.getMyCopayerId();
      $scope.isMobile = isMobile.any();

      if ($rootScope.pendingPayment) {
        $scope.setFromUri($rootScope.pendingPayment)
        $rootScope.pendingPayment = null;
      }

      $scope.setInputs();
      $scope.setScanner();

      rateService.whenAvailable(function() {
        $scope.isRateAvailable = true;
        $scope.$digest();
      });
    }

    $scope.setInputs = function() {
      /**
       * Setting the two related amounts as properties prevents an infinite
       * recursion for watches while preserving the original angular updates
       *
       */
      Object.defineProperty($scope,
        "_alternative", {
          get: function() {
            return this.__alternative;
          },
          set: function(newValue) {
            this.__alternative = newValue;
            if (typeof(newValue) === 'number' && $scope.isRateAvailable) {
              this._amount = parseFloat(
                (rateService.fromFiat(newValue, $scope.alternativeIsoCode) * satToUnit).toFixed(w.settings.unitDecimals), 10);
            } else {
              this._amount = 0;
            }
          },
          enumerable: true,
          configurable: true
        });
      Object.defineProperty($scope,
        "_amount", {
          get: function() {
            return this.__amount;
          },
          set: function(newValue) {
            this.__amount = newValue;
            if (typeof(newValue) === 'number' && $scope.isRateAvailable) {

              this.__alternative = parseFloat(
                (rateService.toFiat(newValue * unitToSat, $scope.alternativeIsoCode)).toFixed(2), 10);
            } else {
              this.__alternative = 0;
            }
          },
          enumerable: true,
          configurable: true
        });

      Object.defineProperty($scope,
        "_address", {
          get: function() {
            return this.__address;
          },
          set: function(newValue) {
            this.__address = $scope.onAddressChange(newValue);
          },
          enumerable: true,
          configurable: true
        });
    };

    $scope.setScanner = function() {
      navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia || navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;
      window.URL = window.URL || window.webkitURL ||
        window.mozURL || window.msURL;

      if (!window.cordova && !navigator.getUserMedia)
        $scope.disableScanner = 1;
    };


    $scope.setError = function(err) {
      copay.logger.warn(err);

      var msg = err.toString();
      if (msg.match('BIG'))
        msg = 'The transaction have too many inputs. Try creating many transactions  for smaller amounts'

      if (msg.match('totalNeededAmount') || msg.match('unspent not set'))
        msg = 'Insufficient funds'

      var message = 'The transaction' + (w.isShared() ? ' proposal' : '') +
        ' could not be created: ' + msg;

      $scope.error = message;

      $timeout(function(){
        $scope.$digest();
      },1);
    };

    $scope.submitForm = function(form) {
      if (form.$invalid) {
        $scope.error = 'Unable to send transaction proposal';
        return;
      }

      $scope.loading = true;

      var url = $scope._url;
      var address = form.address.$modelValue;
      var amount = parseInt((form.amount.$modelValue * unitToSat).toFixed(0));
      var comment = form.comment.$modelValue;

      w.spend({
        toAddress: address,
        amountSat: amount,
        comment: comment,
        url: url,
      }, function(err, txid, status) {
        $scope.loading = false;

        if (err) 
          return $scope.setError(err);

        $scope.resetForm(status);
      });
    };

    // QR code Scanner
    var cameraInput;
    var video;
    var canvas;
    var $video;
    var context;
    var localMediaStream;

    var _scan = function(evt) {
      if ($scope.isMobile) {
        $scope.scannerLoading = true;
        var files = evt.target.files;

        if (files.length === 1 && files[0].type.indexOf('image/') === 0) {
          var file = files[0];

          var reader = new FileReader();
          reader.onload = (function(theFile) {
            return function(e) {
              var mpImg = new MegaPixImage(file);
              mpImg.render(canvas, {
                maxWidth: 200,
                maxHeight: 200,
                orientation: 6
              });

              $timeout(function() {
                qrcode.width = canvas.width;
                qrcode.height = canvas.height;
                qrcode.imagedata = context.getImageData(0, 0, qrcode.width, qrcode.height);

                try {
                  qrcode.decode();
                } catch (e) {
                  // error decoding QR
                }
              }, 1500);
            };
          })(file);

          // Read  in the file as a data URL
          reader.readAsDataURL(file);
        }
      } else {
        if (localMediaStream) {
          context.drawImage(video, 0, 0, 300, 225);

          try {
            qrcode.decode();
          } catch (e) {
            //qrcodeError(e);
          }
        }

        $timeout(_scan, 500);
      }
    };

    var _successCallback = function(stream) {
      video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
      localMediaStream = stream;
      video.play();
      $timeout(_scan, 1000);
    };

    var _scanStop = function() {
      $scope.scannerLoading = false;
      $scope.showScanner = false;
      if (!$scope.isMobile) {
        if (localMediaStream && localMediaStream.stop) localMediaStream.stop();
        localMediaStream = null;
        video.src = '';
      }
    };

    var _videoError = function(err) {
      _scanStop();
    };

    qrcode.callback = function(data) {
      _scanStop();

      $scope.$apply(function() {
        $scope.sendForm.address.$setViewValue(data);
        $scope.sendForm.address.$render();
      });
    };

    $scope.cancelScanner = function() {
      _scanStop();
    };

    $scope.openScanner = function() {
      if (window.cordova) return $scope.scannerIntent();
      $scope.showScanner = true;

      // Wait a moment until the canvas shows
      $timeout(function() {
        canvas = document.getElementById('qr-canvas');
        context = canvas.getContext('2d');

        if ($scope.isMobile) {
          cameraInput = document.getElementById('qrcode-camera');
          cameraInput.addEventListener('change', _scan, false);
        } else {
          video = document.getElementById('qrcode-scanner-video');
          $video = angular.element(video);
          canvas.width = 300;
          canvas.height = 225;
          context.clearRect(0, 0, 300, 225);

          navigator.getUserMedia({
            video: true
          }, _successCallback, _videoError);
        }
      }, 500);
    };

    $scope.scannerIntent = function() {
      cordova.plugins.barcodeScanner.scan(
        function onSuccess(result) {
          if (result.cancelled) return;

          $timeout(function() {
            var data = result.text;
            $scope.$apply(function() {
              $scope.sendForm.address.$setViewValue(result.text);
              $scope.sendForm.address.$render();
            });
          }, 1000);
        },
        function onError(error) {
          alert('Scanning error');
        });
    }

    $scope.setTopAmount = function() {
      var form = $scope.sendForm;
      form.amount.$setViewValue(w.balanceInfo.topAmount);
      form.amount.$render();
      form.amount.$isValid = true;
    };

    $scope.notifyStatus = function(status) {
      if (status == copay.Wallet.TX_BROADCASTED)
        $scope.success = 'Transaction broadcasted!';
      else if (status == copay.Wallet.TX_PROPOSAL_SENT)
        $scope.success = 'Transaction proposal created';
      else if (status == copay.Wallet.TX_SIGNED)
        $scope.success = 'Transaction proposal was signed';
      else if (status == copay.Wallet.TX_SIGNED_AND_BROADCASTED)
        $scope.success = 'Transaction signed and broadcasted!';
      else
        $scope.error = status;

      $timeout(function() {
        $scope.$digest();
      });
    };


    $scope.send = function(ntxid, cb) {
      $scope.error = $scope.success = null;
      $scope.loading = true;
      $rootScope.txAlertCount = 0;
      w.issueTx(ntxid, function(err, txid, status) {
        $scope.loading = false;
        $scope.resetForm(status);
        if (cb) return cb();
      });
    };

    $scope.setForm = function(to, amount, comment) {
      var form = $scope.sendForm;
      form.address.$setViewValue(to);
      form.address.$isValid = true;
      form.address.$render();
      $scope.lockAddress = true;

      if (amount) {
        form.amount.$setViewValue(""+amount);
        form.amount.$isValid = true;
        form.amount.$render();
        $scope.lockAmount = true;
      }

      if (comment) {
        form.comment.$setViewValue(comment);
        form.comment.$isValid = true;
        form.comment.$render();
      }
    };

    $scope.resetForm = function(status) {
      var form = $scope.sendForm;

      form.address.$pristine = form.amount.$pristine = true;
      $scope.fetchingURL = null;
      $scope.lockAddress = false;
      $scope.lockAmount = false;
      form.address.$setViewValue('');
      form.address.$render();
      form.amount.$setViewValue('');
      form.amount.$render();
      form.comment.$setViewValue('');
      form.comment.$render();
      form.$setPristine();

      $scope.notifyStatus(status);
      $timeout(function(){
        $rootScope.$digest();
      },1);
    };


    $scope.openPPModal = function(pp) {
      var ModalInstanceCtrl = function($scope, $modalInstance) {
        $scope.pp = pp;
        $scope.cancel = function() {
          $modalInstance.dismiss('cancel');
        };
      };
      $modal.open({
        templateUrl: 'views/modals/paypro.html',
        windowClass: 'tiny',
        controller: ModalInstanceCtrl,
      });
    };


    $scope.setFromPayPro = function(uri) {
      console.log('[send.js.391:uri:]', uri); //TODO

      $scope.fetchingURL = uri;
      $scope.loading = true;

      var balance = w.balanceInfo.availableBalance;
      var available = +(balance * unitToSat).toFixed(0);

      // Payment Protocol URI (BIP-72)
      w.fetchPaymentRequest({
        url: uri
      }, function(err, merchantData) {
        $scope.loading = false;
        $scope.fetchingURL = null;

        if (err) {
          if (err.match('TIMEOUT')) {
            $scope.resetForm('Payment server timed out');
          } else {
            $scope.resetForm(err.toString());
          }
        } else if (merchantData && available < +merchantData.total) {
          $scope.resetForm('Insufficient funds');
        } else {
          $scope.setForm(merchantData.domain, merchantData.unitTotal)
        }
      });
    };

    $scope.setFromUri = function(uri) {
      var form = $scope.sendForm;

      var parsed = new bitcore.BIP21(uri);
      if (!parsed.isValid() || !parsed.address.isValid()) {
        $scope.error = 'Invalid bitcoin URL';
        form.address.$isValid = false;
        return uri;
      };

      var addr = parsed.address.toString();

console.log('[send.js.430:parsed:]',addr,parsed.data); //TODO

      if (parsed.data.merchant)
        return $scope.setFromPayPro(parsed.data.merchant);

      var amount = (parsed.data && parsed.data.amount) ?
        (parsed.data.amount * 100000000).toFixed(0) * satToUnit : 0;

      $scope.setForm(addr, amount, parsed.data.message, true);
      return addr;
    };

    $scope.onAddressChange = function(value) {
      var addr;
      console.log('[send.js.391:value:]', value); //TODO

      $scope.error = $scope.success = null;
      if (!value) return '';

      if (value.indexOf('bitcoin:') === 0) {
        return $scope.setFromUri(value);
      } else if (/^https?:\/\//.test(value)) {
        return $scope.setFromPayPro(value);
      }
      return value;
    };

    $scope.openAddressBook = function() {
      var modalInstance = $modal.open({
        templateUrl: 'views/modals/address-book.html',
        windowClass: 'large',
        controller: function($scope, $modalInstance) {

          $scope.showForm = null;
          $scope.addressBook = w.addressBook;

          $scope.hasEntry = function() {
            return _.keys($scope.addressBook).length > 0 ? true : false;
          };

          $scope.toggleAddressBookEntry = function(key) {
            w.toggleAddressBookEntry(key);
          };

          $scope.copyToSend = function(addr) {
            $modalInstance.close(addr);
          };

          $scope.cancel = function() {
            $scope.error = $scope.success = null;
            $scope.toggleForm();
          };

          $scope.toggleForm = function() {
            $scope.showForm = !$scope.showForm;
          };

          $scope.submitAddressBook = function(form) {
            if (form.$invalid) {
              return;
            }
            $timeout(function() {
              var errorMsg;
              var entry = {
                "address": form.newaddress.$modelValue,
                "label": form.newlabel.$modelValue
              };
              try {
                w.setAddressBook(entry.address, entry.label);
              } catch (e) {
                console.log('[send.js:583]', e); //TODO
                errorMsg = e.message;
              }

              if (errorMsg) {
                $scope.error = errorMsg;
              } else {
                $scope.toggleForm();
                $scope.success = 'New entry has been created';
              }
              $rootScope.$digest();
            }, 500);

            $timeout(function() {
              $scope.error = $scope.success = null;
            }, 5000);

            return;

          };

          $scope.close = function() {
            $modalInstance.dismiss('cancel');
          };
        },
      });

      modalInstance.result.then(function(addr) {
        $scope._address = addr;
      });
    };

  });
