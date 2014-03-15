
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

regexpServices.factory('$RegexpWorker', ['$q', '$timeout', '$RegexpValues', function($q, $timeout, $RegexpValues) {
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
        function run() {
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
            var data = {
                'regexp': $RegexpValues.regexp,
                'modifiers': $RegexpValues.modifiers,
                'search': $RegexpValues.search,
                'replace': $RegexpValues.replace
            };
            currentWorker.postMessage(data);
            timeoutPromise = $timeout(kill, 5000);
            return currentDefered.promise;
        }
        return {
            run: run
        };
    }]);
/**
 * Service to keep current form in sync storage.
 * Chrome's synch storage has limitations of amount of operations per minute 
 * so the app should update sync storage only for a fixed period of time
 * (after something change).
 * Available functions:
 * sync() - tell SyncService to perform a sync operation. It will take an action only if there waren't previous operation in set period of time.
 */
regexpServices.factory('$SyncService', ['$ChromeStorage', '$RegexpValues', '$timeout', 'APP_EVENTS', '$rootScope', function($ChromeStorage, $RegexpValues, $timeout, APP_EVENTS, $rootScope) {
    var service = {
        timeout: null,
        get delay(){ return 10000; },
        sync: function(){
            if (this.timeout !== null) {
                $timeout.cancel(this.timeout);
                this.timeout = null;
            }
            this.timeout = $timeout(function() {
                $ChromeStorage.set('sync', {'latest': $RegexpValues}).then(function(){
                    $rootScope.$broadcast(APP_EVENTS.regexpValuesSynced);
                }, function(reason){
                    console.error('There was an error during sync save.', reason);
                    var message = null;
                    if(reason.message.indexOf('QUOTA_BYTES_PER_ITEM') === 0){
                        message = 'Can\'t save current form to sync storage. Too much data!';
                    } else if(reason.message.indexOf('MAX_WRITE_OPERATIONS_PER_HOUR') === 0){
                        message = 'Can\'t save current form to sync storage. Too many operations per hour.';
                    } else if(reason.message.indexOf('MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE') === 0){
                        message = 'Can\'t save current form to sync storage. Too many operations per minute.';
                    } else if(reason.message.indexOf('MAX_ITEMS') === 0){
                        message = 'Can\'t save current form to sync storage. Too much items!';
                    } else if(reason.message.indexOf('QUOTA_BYTES') === 0){
                        message = 'Can\'t save current form to sync storage. Too much data! (QUOTA_BYTES)';
                    } else {
                        message = 'Can\'t save current values to sync storage. Unknown error.';
                    }
                    
                    $rootScope.$broadcast(APP_EVENTS.errorOccured, message, reason);
                });
                this.timeout = null;
            }.bind(this), 10000);
        }
    };
    return service;
}]);
regexpServices.factory('$RegexpValues', ['$q', '$ChromeStorage', '$indexedDB', '$rootScope', 'APP_EVENTS', function($q, $ChromeStorage, $indexedDB, $rootScope, APP_EVENTS) {

        var innerFunctions = ['store', 'restore', 'save', 'open'];

        /**
         * Creates a new object with current values. 
         * This object is ready to store either in local/sync storage or IndexedDb
         * @return {Object} current values for the RegExp form.
         */
        function createStoreValues() {
            var res = {};
            for (var _key in data) {
                if (innerFunctions.indexOf(_key) !== -1)
                    continue;
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
                    if (innerFunctions.indexOf(_key) !== -1)
                        continue;

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
                        if (innerFunctions.indexOf(_key) !== -1)
                            continue;
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
                        $rootScope.$broadcast(APP_EVENTS.errorOccured, 'Error restoring app data', reason);
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
            'save': function(note) {
                var store = $indexedDB.objectStore('regexp_store');
                var data = createStoreValues();
                data.note = note || '';
                data.created = Date.now();
                var deferred = $q.defer();
                store.upsert(data).then(function(result) {
                    deferred.resolve(result);
                }, deferred.reject);
                return deferred.promise;
            },
            'open': function(id) {
                var store = $indexedDB.objectStore('regexp_store');
                var deferred = $q.defer();
                store.find(id).then(function(result) {
                    console.log('Data opened', result);
                    deferred.resolve(result);
                }, deferred.reject);
                return deferred.promise;
            },
            get modifiers(){
                var result = '';
                if (data.global) {
                    result += 'g';
                }
                if (data.insensitive) {
                    result += 'i';
                }
                if (data.multiline) {
                    result += 'm';
                }
                return result;
            }
        };
        return data;
    }]);


regexpServices.factory('$MouseTrapService', ['$q', function($q) {
        function register(cmd) {
            var defered = $q.defer();
            Mousetrap.bind(cmd, function() {
                defered.notify();
            });
            return defered.promise;
        }
        return register;
    }]);
regexpServices.factory('$OpenSaveService', ['$q','$MouseTrapService','$modal','$RegexpValues','$indexedDB','$rootScope','APP_EVENTS', function($q,$MouseTrapService,$modal,$RegexpValues,$indexedDB,$rootScope,APP_EVENTS) {
        var saveModal = null, openModal = null;
        
        function openAction(){
            if (openModal !== null)
                return;
            
            openModal = $modal.open({
                templateUrl: 'partials/opendialog.html',
                controller: OpenDialogCtrl,
                resolve: {
                    '$indexedDB': function() {
                        return $indexedDB;
                    },
                    '$rootScope': function(){
                        return $rootScope;
                    },
                    'APP_EVENTS': function() {
                        return APP_EVENTS;
                    }
                }
            });
            openModal.result.then(function(rg) {
                openModal = null;
                $RegexpValues.regexp = rg.regexp;
                $RegexpValues.search = rg.search;
                $RegexpValues.replace = rg.replace;
                $RegexpValues.multiline = rg.multiline;
                $RegexpValues.insensitive = rg.insensitive;
                $RegexpValues.global = rg.global;
                $RegexpValues.autotest = rg.autotest;
                $RegexpValues.store();
            }, function() {
                openModal = null;
                //cancel or esc
            });
        }
        function saveAction(){
            if (saveModal !== null)
                return;
            
            if($RegexpValues.regexp.trim() === ''){
                $rootScope.$broadcast(APP_EVENTS.errorOccured, 'You must enter regexp first.');
                return;
            }
            
            
            saveModal = $modal.open({
                templateUrl: 'partials/savedialog.html',
                controller: SaveDialogCtrl,
                resolve: {
                    '$indexedDB': function() {
                        return $indexedDB;
                    },
                    '$RegexpValues': function(){
                        return $RegexpValues;
                    }
                }
            });
            saveModal.result.then(function(note) {
                saveModal = null;
                $RegexpValues.save(note);
                $rootScope.$broadcast(APP_EVENTS.regexpValuesSaved);
            }, function() {
                saveModal = null;
                //cancel or esc
            });
        }
        function SaveDialogCtrl($scope, $modalInstance, $indexedDB, $RegexpValues) {
            $scope.note = '';
            $scope.override = false;
            $scope.cancel = function() {
                $modalInstance.dismiss('cancel');
            };
            $scope.save = function(note) {
                $modalInstance.close(note);
            };
            
            var checkCurrentSaved = function(){
                var key = $RegexpValues.regexp;
                var store = $indexedDB.objectStore('regexp_store');
                store.find(key).then(function(item) {
                    if(!!item){
                        $scope.override = true;
                        $scope.note = item.note;
                    }
                }, function(reason) {
                    console.error('Unable to find a key',reason);
                });
            };
            checkCurrentSaved();
        }
        function OpenDialogCtrl($scope, $modalInstance, $indexedDB,$rootScope,APP_EVENTS) {
            $scope.items = [];
            $scope.selected = {
                item: null
            };
            $scope.loading = true;
            $scope.disabledSelect = true;
            function restoreAll() {
                var store = $indexedDB.objectStore('regexp_store');
                store.getAll().then(function(items) {
                    $scope.loading = false;
                    $scope.items = items;
                }, function(reason) {
                    //todo: error message
                    $rootScope.$broadcast(APP_EVENTS.errorOccured, 'There was an error retriving data from database :( Try again.');
                });
            }

            restoreAll();
            $scope.select = function(item) {
                $scope.selected.item = item;
                $scope.disabledSelect = false;
            };
            $scope.apply = function() {
                $modalInstance.close($scope.selected.item);
            };

            $scope.cancel = function() {
                $modalInstance.dismiss('cancel');
            };
        }
        
        function registerHandlers(){
            $MouseTrapService(['ctrl+s', 'command+s']).then(null, null, saveAction);
            $MouseTrapService(['ctrl+o', 'command+o']).then(null, null, openAction);
        }

        return {
            'register': registerHandlers,
            'open': openAction,
            'save': saveAction
        };
    }]);