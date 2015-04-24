'use strict';

angular.module('copayApp.services')
  .factory('fileStorageService', function(lodash, $log) {
    var root = {}, fs;


    root.init = function(cb) {
      if (fs) return cb(null, fs);

      function onFileSystemSuccess(fileSystem) {
        console.log('File system started: ', fileSystem.name, fileSystem.root.name);
        fs = fileSystem;
        return cb(null, fs);
      }

      function fail(evt) {
        var msg = 'Could not init file system: ' + evt.target.error.code;
        console.log(msg);
        return cb(msg);
      };

      window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, onFileSystemSuccess, fail);
    };


    root.get = function(k, cb) {
      root.init(function(err, fs) {
        if (err) return cb(err);
        fs.root.getFile(k, {
          create: false,
        }, function(fileEntry) {
          if (!fileEntry) return cb();
          fileEntry.file(function(file) {
            var reader = new FileReader();

            reader.onloadend = function(e) {
              console.log("Read: " + this.result);
              return cb(null, this.result)
            }

            reader.readAsText(file);
          });
        }, function(err) {
          // Not found
          if (err.code==1) return cb();
          else return cb(err);
        });
      })
    };

    root.set = function(k, v, cb) {
      root.init(function(err, fs) {
        if (err) return cb(err);
        fs.root.getFile(k, {
          create: true,
        }, function(fileEntry) {
          // Create a FileWriter object for our FileEntry (log.txt).
          fileEntry.createWriter(function(fileWriter) {

            fileWriter.onwriteend = function(e) {
              console.log('Write completed.');
              return cb();
            };

            fileWriter.onerror = function(e) {
              console.log('Write failed: ' + e.toString());
              return cb('Fail to write:', e.toString());
            };

            if (lodash.isObject(v))
              v = JSON.stringify(v);

            var blob = new Blob([v], {
              type: "application/json"
            });

            fileWriter.write(blob);

          }, cb);
        });

      });
    };

    root.remove = function(k, cb) {
      root.init(function(err, fs) {
        if (err) return cb(err);
        fs.root.getFile(k, {
          create: false,
        }, function(fileEntry) {
          // Create a FileWriter object for our FileEntry (log.txt).
          fileEntry.remove(function() {
            console.log('File removed.');
            return cb();
          }, cb, cb);
        });
      });
    };

    /**
     * Same as setItem, but fails if an item already exists
     */
    root.create = function(name, value, callback) {
      root.get(name,
        function(err, data) {
          if (data) {
            return callback('EEXISTS');
          } else {
            return root.set(name, value, callback);
          }
        });
    };


    return root;
  });
