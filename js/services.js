
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
/**
 * @ngdoc service
 * @name $RegexpWorker
 * 
 * @description This serwice will run background worker to evaluate provided by the user RegExp
 * and to highlight and/or replace matched from search string.
 * Worker will return HTML code ready to be inserted to the output window.
 * 
 * When form will change during background work and another worker should be used the app
 * will force kill previous worker and create new one.
 * @param {$q} $q Dependency for $q object
 * @param {$timeout} $timeout Dependency for $timeout object
 * @param {$RegexpValues} $RegexpValues Dependency for $RegexpValues service
 */
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
 * @ngdoc service
 * @name $SyncService
 * 
 * @description Service to keep current form in sync storage.
 * Chrome's synch storage has limitations of amount of operations per minute 
 * so the app should update sync storage only for a fixed period of time
 * (after something change).
 * Available functions:
 * sync() - tell SyncService to perform a sync operation. It will take an action only if there waren't previous operation in set period of time.
 */
regexpServices.factory('$SyncService', ['$ChromeStorage', '$RegexpValues', '$timeout', 'APP_EVENTS', '$rootScope', function($ChromeStorage, $RegexpValues, $timeout, APP_EVENTS, $rootScope) {
    var service = {
        timeout: null,
        /**
         * @ngdoc getter
         * @name $SyncService.delay
         * @function
         * 
         * @description Number of miliseconds between the app can write to sync storage.
         * Sync storage have limited number of write operations per minute/hours so it should be limited by the app.
         * @returns {Number} Number of miliseconds
         */
        get delay(){ return 10000; },
        /**
         * @ngdoc function
         * @name $SyncService.sync
         * @function
         * 
         * @description Perform a write operation on a sync storage.
         * If latest write operation has been performed less than {@link $SyncService.delay} miliseconds ago it do nothing and next write operation will be performed after set period of time.
         * 
         * @returns {undefined}
         */
        sync: function(){
            if (this.timeout !== null) {
//                $timeout.cancel(this.timeout);
//                this.timeout = null;
                return;
            }
            this.timeout = $timeout(function() {
                $ChromeStorage.set('sync', {'latest': $RegexpValues.storeValues}).then(function(){
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
/**
 * @ngdoc service
 * @name $RegexpValues
 * 
 * @description This service is used to perform CRUD operations on current form values.
 */
regexpServices.factory('$RegexpValues', ['$q', '$ChromeStorage', '$indexedDB', '$rootScope', 'APP_EVENTS', function($q, $ChromeStorage, $indexedDB, $rootScope, APP_EVENTS) {

        var service = {
            'regexp': '',
            'search': '',
            'replace': '',
            'multiline': false,
            'global': true,
            'insensitive': false,
            'autotest': false,
            /**
             * @ngdoc getter
             * @name $RegexpValues.storeValues
             * @function
             * 
             * @description Creates a new object with current values. 
             * This object is ready to store either in local/sync storage or IndexedDb
             * 
             * @returns {Object} current values for the RegExp form.
             */
            get storeValues(){
                var res = {};
                
                res.regexp = service.regexp;
                res.search = service.search;
                res.replace = service.replace;
                res.multiline = service.multiline;
                res.insensitive = service.insensitive;
                res.global = service.global;
                res.autotest = service.autotest;
                
                return res;
            },
            /**
             * @ngdoc method
             * @name $RegexpValues.store
             * @function
             * 
             * @description Store current value to local storage for further use during app's bootstrap.
             * It can't use sync storage here because of limitations of sync store (write operations limit).
             * This function should be called each time the form change.
             * 
             * @returns {$q@call;defer.promise}
             */
            'store': function() {
                var deferred = $q.defer();
                $ChromeStorage.set('local', {'latest': this.storeValues}).then(deferred.resolve, deferred.reject);
                return deferred.promise;
            },
            /**
             * @ngdoc method
             * @name $RegexpValues.restore
             * @function
             * 
             * @description Restore lates form values from sync/local storage.
             * It will propagate itself with restored values (if any).
             * This method will check sync storage in the first place. If will not find a "latest" key it will try to find it in local storage.
             * If lates fails it do nothing.
             * 
             * @returns {undefined}
             */
            'restore': function() {
                function fallback() {
                    $ChromeStorage.get('local', {'latest': null}).then(function(restored){
                        if (!restored.latest) {
                            return;
                        }
                        service.updateCurrent(restored.latest);
                    }, function(reason) {
                        console.error('Error restoring app data', reason);
                        $rootScope.$broadcast(APP_EVENTS.errorOccured, 'Error restoring app data', reason);
                    });
                }
                
                $ChromeStorage.get('sync', {'latest': null}).then(function(restored) {
                    if (!restored.latest) {
                        fallback();
                        return;
                    }
                    service.updateCurrent(restored.latest);
                }.bind(this), function(reason) {
                    console.error('Error restoring app data', reason);
                    fallback();
                });

            },
            /**
             * @ngdoc getter
             * @name $RegexpValues.key
             * @function
             * 
             * @description Generate DB's key value for current form.
             * It can be used to find a record already created from current form
             * or to create key value for new DB ibject
             * 
             * @returns {String} Generated key
             */
            get key(){
                return service.regexp + '|' + service.multiline + '|' + service.insensitive + '|' + service.global;
            },
            /**
             * @ngdoc method
             * @name $RegexpValues.save
             * @function
             * 
             * @description Save current values to IndexedDB.
             * 
             * @param {String} note Optional note as a name for DB record.
             * @returns {$q@call;defer.promise}
             */
            'save': function(note) {
                var store = $indexedDB.objectStore('regexp_store');
                var data = service.storeValues;
                data.note = note || '';
                data.created = Date.now();
                data.key = service.key;
                var deferred = $q.defer();
                store.upsert(data).then(function(result) {
                    deferred.resolve(result);
                }, deferred.reject);
                return deferred.promise;
            },
            /**
             * @ngdoc method
             * @name $RegexpValues.open
             * @function
             * 
             * @description Open saved form value from IndexedDb
             * 
             * @param {any} id Key for stored data.
             * @returns {$q@call;defer.promise}
             */
            'open': function(id) {
                var store = $indexedDB.objectStore('regexp_store');
                var deferred = $q.defer();
                store.find(id).then(function(result) {
                    console.log('Data opened', result);
                    deferred.resolve(result);
                }, deferred.reject);
                return deferred.promise;
            },
            /**
             * @ngdoc getter
             * @name $RegexpValues.modifiers
             * @getter
             * 
             * @description Get RegExp object modigiers from current values.
             * 
             * @returns {String} modifiers for RegExp object.
             */
            get modifiers(){
                var result = '';
                if (service.global) {
                    result += 'g';
                }
                if (service.insensitive) {
                    result += 'i';
                }
                if (service.multiline) {
                    result += 'm';
                }
                return result;
            },
            /**
             * @ngdoc method
             * @name $RegexpValues.update
             * @function
             * 
             * @description update form values from other object (restored from local storage or DB).
             * 
             * @param {Object} rg Restored object
             * @returns {undefined} Nothing
             */
            updateCurrent: function(rg){
                
                service.regexp = rg.regexp;
                service.search = rg.search;
                service.replace = rg.replace;
                service.multiline = rg.multiline;
                service.insensitive = rg.insensitive;
                service.global = rg.global;
                service.autotest = rg.autotest;
                service.store();
            }
        };
        return service;
    }]);

/**
 * @ngdoc service
 * @name $MouseTrapService
 * 
 * @description This service is a wrapper for MouseTrap lib.
 */
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
/**
 * @ngdoc service
 * @name $OpenSaveService
 * 
 * @description This service is performs open and save operations called by the user.
 */
regexpServices.factory('$OpenSaveService', ['$q','$MouseTrapService','$modal','$RegexpValues','$indexedDB','$SyncService','$StoredDataService','$rootScope','APP_EVENTS', function($q,$MouseTrapService,$modal,$RegexpValues,$indexedDB,$SyncService,$StoredDataService,$rootScope,APP_EVENTS) {
        var saveModal = null, openModal = null;
        
        function openAction(){
            if (openModal !== null)
                return;
            
            openModal = $modal.open({
                templateUrl: 'partials/opendialog.html',
                controller: OpenDialogCtrl,
                resolve: {
                    '$StoredDataService': function() {
                        return $StoredDataService;
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
                $RegexpValues.updateCurrent(rg);
                $SyncService.sync();
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
                $RegexpValues.save(note).then(function(savedKey){
                    $rootScope.$broadcast(APP_EVENTS.regexpValuesSaved,savedKey);
                });
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
                var key = $RegexpValues.key;
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
        function OpenDialogCtrl($scope, $modalInstance, $StoredDataService, $rootScope,APP_EVENTS) {
            $scope.items = $StoredDataService;
            $scope.selected = {
                item: null
            };
            $scope.loading = true;
            $scope.disabledSelect = true;
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
/**
 * @ngdoc service
 * @name $StoredDataService
 * 
 * @description This service is used as a model for saved DB items.
 */
regexpServices.factory('$StoredDataService', ['$q','$indexedDB','$rootScope','APP_EVENTS', function($q,$indexedDB,$rootScope,APP_EVENTS) {
    var model = {
        items: [],
        restore: function(){
            var defered = $q.defer();
            var store = $indexedDB.objectStore('regexp_store');
            store.getAll().then(function(items) {
                model.items = items;
                defered.resolve(items);
            }, function(reason) {
                defered.reject(reason);
            });
            return defered.promise;
        }
    };
     
    $rootScope.$on(APP_EVENTS.regexpValuesSaved, function(e, item){
        model.restore();
        //model.items.push(item);
        //console.log(item);
    });
    return model;
}]);