
var regexpServices = angular.module('regexp.service', []);
regexpServices.factory('$ChromeStorage', ['$q', function($q) {

        /**
         * Save data to Chrome's local or synch storage.
         * @param {String} type - optional, default local, may be sync
         * @param {Object} data - data to save
         *
         * @example 
         *  $ChromeStorage.save({'key':'value'}); //save data to local storage
         *  $ChromeStorage.save('sync', {'key':'value'}); //save data to synch storage
         *  $ChromeStorage.save('local', {'key':'value'}); //save data to local storage
         *
         * @return The Promise object. Defered.then() function will not return a param.
         */
        function saveData(type, data) {
            if (typeof data === 'undefined') {
                data = type;
                type = 'local';
            }
            var defered = $q.defer();
            if (['local', 'sync'].indexOf(type) === -1) {
                defered.reject('Unknown storage type: ' + type);
                return defered.promise;
            }

            var storage = chrome.storage[type];
            storage.set(data, function() {
                if (chrome.runtime.lastError) {
                    defered.reject(chrome.runtime.lastError);
                    return;
                }
                defered.resolve();
            });

            return defered.promise;
        }

        /**
         * Restore data from Chrome's local or synch storage.
         * @param {String} type - optional, default local, may be sync
         * @param {String|Array|Object} data - data to restore. See chrome app's storage for more details. 
         *
         * @example 
         *  $ChromeStorage.get({'key':'default_value'}); //restore data from local storage
         *  $ChromeStorage.save('sync', 'key'); //restore data from synch storage
         *  $ChromeStorage.save('local', ['key1', 'key2']); //restore data from local storage
         *
         * @return The Promise object. Defered.then() function will return a param with restored data.
         */
        function restoreData(type, data) {
            if (typeof data === 'undefined') {
                data = type;
                type = 'local';
            }
            var defered = $q.defer();
            if (['local', 'sync'].indexOf(type) === -1) {
                defered.reject('Unknown storage type: ' + type);
                return defered.promise;
            }

            var storage = chrome.storage[type];
            storage.get(data, function(restored) {
                if (chrome.runtime.lastError) {
                    defered.reject(chrome.runtime.lastError);
                    return;
                }
                defered.resolve(restored);
            });

            return defered.promise;
        }

        return {
            'set': saveData,
            'get': restoreData
        };
    }]);

regexpServices.factory('$RegexpWorker', ['$q', '$timeout', function($q, $timeout) {
        var currentWorker = null;
        var timeoutPromise = null;
        var currentDefered = null;
        function kill() {
            if (currentWorker !== null) {
                currentWorker.terminate();
                currentWorker = null;
            }
            if (timeoutPromise !== null) {
                $timeout.cancel(timeoutPromise);
                timeoutPromise = null;
            }
        }
        function run(data) {
            if (currentDefered) {
                currentDefered = null;
            }
            currentDefered = $q.defer();
            kill();
            currentWorker = new Worker(chrome.runtime.getURL('js/worker.js'));
            currentWorker.onmessage = function(e) {
                currentDefered.resolve(e.data);
                if (timeoutPromise !== null) {
                    $timeout.cancel(timeoutPromise);
                    timeoutPromise = null;
                }
            };
            currentWorker.onerror = function(e) {
                console.error(e);
                currentDefered.reject(e.message);
                if (timeoutPromise !== null) {
                    $timeout.cancel(timeoutPromise);
                    timeoutPromise = null;
                }
            };
            currentWorker.postMessage(data);
            timeoutPromise = $timeout(kill, 5000);
            return currentDefered.promise;
        }

        return {
            run: run
        };
    }]);

regexpServices.factory('$RegexpValues', ['$q', '$ChromeStorage', '$indexedDB', function($q, $ChromeStorage, $indexedDB) {
  
  var innerFunctions = ['store','restore','save','open'];
  
  /**
   * Creates a new object with current values. 
   * This object is ready to store either in local/sync storage or IndexedDb
   * @return {Object} current values for the RegExp form.
   */
  function createStoreValues(){
    var res = {};
    for (var _key in data) {
      if(innerFunctions.indexOf(_key) !== -1) continue;
      if (typeof data[_key] !== 'function') {
        res[_key] = data[_key];
      }
    }
    return res;
  }
  
  
        var data = {
            'regexp': '',
            'search': '',
            'replace': '',
            'multiline': false,
            'global': true,
            'insensitive': false,
            'autotest': false,
            'store': function() {
                var deferred = $q.defer();
                var res = {};
                for (var _key in this) {
                  if(innerFunctions.indexOf(_key) !== -1) continue;
                  
                    if (typeof this[_key] !== 'function') {
                        res[_key] = this[_key];
                    }
                }
                $ChromeStorage.set('local', {'latest': res}).then(deferred.resolve, deferred.reject);
                return deferred.promise;
            },
            'restore': function() {
                var ctx = this;

                function fillObject(restored) {
                    for (var _key in restored) {
                      if(innerFunctions.indexOf(_key) !== -1) continue;
                        if (typeof restored[_key] !== 'function') {
                            ctx[_key] = restored[_key];
                        }
                    }
                }

                function fallback() {
                    $ChromeStorage.get('local', {'latest': null}).then(function(data) {
                        fillObject(data.latest);
                    }.bind(this), function(reason) {
                        console.error('Error restoring app data', reason);
                    });
                }

                $ChromeStorage.get('sync', {'latest': null}).then(function(data) {
                    if (!data.latest) {
                        fallback();
                        return;
                    }
                    fillObject(data.latest);
                }.bind(this), function(reason) {
                    console.error('Error restoring app data', reason);
                    fallback();
                });

            },
          'save': function(note){
            var store = $indexedDB.objectStore('regexp_store');
            var data = createStoreValues();
            data.note = note || '';
            data.created = Date.now();
            var deferred = $q.defer();
            store.upsert(data).then(function(result){
              console.log('Data saved', result);
              deferred.resolve(result);
            }, deferred.reject);
            return deferred.promise;
          },
          'open': function(id){
            var store = $indexedDB.objectStore('regexp_store');
            var deferred = $q.defer();
            store.find(id).then(function(result){
              console.log('Data opened', result);
              deferred.resolve(result);
            }, deferred.reject);
            return deferred.promise;
          }
        };

        return data;
    }]);


regexpServices.factory('$MouseTrapService', ['$q', function($q) {
        function register(cmd){
            var defered = $q.defer();
            Mousetrap.bind(cmd, function() { 
                defered.notify();
            });
            return defered.promise;
        }
        
        return register;
}]);
