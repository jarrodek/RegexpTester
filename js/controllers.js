function RegexpController($scope, $RegexpValues, $ChromeStorage, $RegexpWorker, $window, $timeout, $modal, $MouseTrapService, $indexedDB) {
    $scope.data = $RegexpValues;
    $scope.searchFound = 0;
    $scope.replaceFound = 0;
    $scope.autotest = false;
    $scope.invalidPattern = false;
    $scope.result = {
        'highlight': '',
        'replace': ''
    };
    $RegexpValues.restore();

    function cleanupResults() {
        $scope.result.highlight = $scope.result.replace = '';
        $scope.searchFound = 0;
    }

    $scope.runTest = function() {
        if (!$scope.data.regexp.trim()) {
            cleanupResults();
            return;
        }
        $RegexpWorker.run({
            'regexp': $scope.data.regexp,
            'modifiers': getModifiers(),
            'search': $scope.data.search,
            'replace': $scope.data.replace
        }).then(function(result) {
            if (!result) {
                cleanupResults();
                if (!$scope.invalidPattern)
                    $scope.invalidPattern = true;
                return;
            }
            if ($scope.invalidPattern)
                $scope.invalidPattern = false;

            $scope.result.highlight = result.highlight;
            $scope.result.replace = result.replace;
            $scope.searchFound = result.search_found;
            setResultsBoxSize();
        }, function(reason) {
            console.error('worker error', reason);
        });
    };
    function testPattern() {
        try {
            new RegExp('(' + $scope.data.regexp + ')', getModifiers());
        } catch (e) {
            $scope.invalidPattern = true;
            return;
        }
        $scope.invalidPattern = false;
    }

    function getModifiers() {
        var result = '';
        if ($scope.data.global) {
            result += 'g';
        }
        if ($scope.data.insensitive) {
            result += 'i';
        }
        if ($scope.data.multiline) {
            result += 'm';
        }
        return result;
    }

    /**
     * Called each time when form has changed
     */
    function onChange() {
        saveSync();
        if (!$scope.data.autotest) {
            testPattern();
            return;
        }

        $scope.runTest();
    }




    //watch form elements and update localstorage if change
    $scope.$watch('data', function(newValue, oldValue) {
        if (newValue === oldValue)
            return;
        $RegexpValues.store();
        onChange();
    }, true);


    function setResultsBoxSize() {
        var h = $window.innerHeight;
        var els = document.querySelectorAll('.appresults');
        for (var i = 0, len = els.length; i < len; i++) {
            var el = els[i];
            var box = el.getBoundingClientRect();
            var top = box.top;
            el.style.height = (h - top) + 'px';
        }
    }

    $window.addEventListener('resize', function(e) {
        setResultsBoxSize();
    }, false);
    $scope.resizeField = function() {
        $timeout(setResultsBoxSize);
    };

    //
    // The app will save current regexp data into sync storage.
    // However don't do it whenever a user change the form. 20 secs of inactivity should be OK.
    // Call this function on each form change but it will work only after 20 secs of inactivity.
    //
    var latestSyncTimeout = null;
    function saveSync() {
        if (latestSyncTimeout !== null) {
            $timeout.cancel(latestSyncTimeout);
            latestSyncTimeout = null;
        }
        latestSyncTimeout = $timeout(function() {
            chrome.storage.sync.set({latest: $scope.data}, function() {
                console.log('Saved state in sync');
            });
            latestSyncTimeout = null;
        }, 10000);
    }

    var saveModal = null, openModal = null;
    $MouseTrapService(['ctrl+s', 'command+s']).then(null, null, function() {
        if (saveModal !== null)
            return;
        saveModal = $modal.open({
            templateUrl: 'partials/savedialog.html',
            controller: SaveDialogCtrl
        });
        saveModal.result.then(function(note) {
            saveModal = null;

            $RegexpValues.save(note);
        }, function() {
            saveModal = null;
        });
    });
    $MouseTrapService(['ctrl+o', 'command+o']).then(null, null, function() {
        if (openModal !== null)
            return;
        openModal = $modal.open({
            templateUrl: 'partials/opendialog.html',
            controller: OpenDialogCtrl,
            resolve: {
                '$indexedDB': function() {
                    return $indexedDB;
                }
            }
        });
        openModal.result.then(function(rg) {
            openModal = null;
            $scope.data.regexp = rg.regexp;
            $scope.data.search = rg.search;
            $scope.data.replace = rg.replace;
            $scope.data.multiline = rg.multiline;
            $scope.data.insensitive = rg.insensitive;
            $scope.data.global = rg.global;
            $scope.data.autotest = rg.autotest;
        }, function() {
            openModal = null;
        });
    });
}
RegexpController.$inject = ['$scope', '$RegexpValues', '$ChromeStorage', '$RegexpWorker', '$window', '$timeout', '$modal', '$MouseTrapService', '$indexedDB'];


function SaveDialogCtrl($scope, $modalInstance) {
    $scope.note = '';
    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };
    $scope.save = function(note) {
        $modalInstance.close(note);
    };
}


function OpenDialogCtrl($scope, $modalInstance, $indexedDB) {
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
            //todo
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


function ResultController($scope) {
}
ResultController.$inject = ['$scope'];

function ModalHelpCtrl($scope, $modal) {

    var ModalInstanceCtrl = function($scope, $modalInstance) {
        $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
        };
    };


    $scope.openHelpDialog = function() {
        $modal.open({
            templateUrl: 'partials/patternsdialog.html',
            controller: ModalInstanceCtrl
        });
    };
}
ModalHelpCtrl.$inject = ['$scope', '$modal'];