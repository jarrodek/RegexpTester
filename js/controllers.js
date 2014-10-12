function RegexpController($scope, $RegexpValues, $RegexpWorker, $OpenSaveService, $SyncService, $rootScope, APP_EVENTS) {
    $scope.data = $RegexpValues;
    $scope.searchFound = 0;
    $scope.replaceFound = 0;
    $scope.autotest = false;
    $scope.invalidPattern = false;
    $scope.result = {
        'highlight': '',
        'replace': ''
    };
    $scope.error = null;
    $rootScope.$on(APP_EVENTS.errorOccured, function(e, msg, reason){
        $scope.error = null;
        $scope.error = msg;
    });

    $RegexpValues.restore();

    $scope.closeErrorAlert = function(){
        $scope.error = null;
    };

    function cleanupResults() {
        $scope.result.highlight = $scope.result.replace = '';
        $scope.searchFound = 0;
    }
    $scope.runTest = function() {
        if (!$scope.data.regexp.trim()) {
            cleanupResults();
            return;
        }
        $RegexpWorker.run().then(function(result) {
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
        }, function(reason) {
            console.error('worker error', reason);
        });
    };
    function testPattern() {
        try {
            new RegExp('(' + $scope.data.regexp + ')', $RegexpValues.modifiers);
        } catch (e) {
            $scope.invalidPattern = true;
            return;
        }
        $scope.invalidPattern = false;
    }

    /**
     * Called each time when form has changed
     */
    function onChange() {
        $RegexpValues.store();
        $SyncService.sync();
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
        onChange();
    }, true);
    $scope.openDialog = $OpenSaveService.open;
    $scope.saveDialog = $OpenSaveService.save;
    $OpenSaveService.register();
}
RegexpController.$inject = ['$scope', '$RegexpValues', '$RegexpWorker', '$OpenSaveService', '$SyncService', '$rootScope', 'APP_EVENTS'];

/**
 * Results tabls controller
 * TODO: remove it
 * @param {type} $scope
 * @returns {ResultController}
 */
function ResultController($scope) {
}
ResultController.$inject = ['$scope'];

/**
 * Controler for help dialog.
 * TODO: is it should be a directive?
 * @param {type} $scope
 * @param {type} $modal
 * @param {type} $http
 * @returns {ModalHelpCtrl}
 */
function ModalHelpCtrl($scope, $modal, $http) {
    var ModalInstanceCtrl = function($scope, $modalInstance,$http) {

        $scope.data = null;
        $scope.cancel = function() {
            $modalInstance.dismiss('cancel');
        };

        $http.get(chrome.runtime.getURL('data/patterns_definitions.json')).then(function(data){
            $scope.data = data.data;
        });
    };
    $scope.openHelpDialog = function() {
        $modal.open({
            templateUrl: 'partials/patternsdialog.html',
            controller: ModalInstanceCtrl,
            resolve: {
                '$http': function() {
                    return $http;
                }
            }
        });
    };
}
ModalHelpCtrl.$inject = ['$scope', '$modal', '$http'];


function AsideController($scope, $StoredDataService, $timeout, $RegexpValues,$SyncService) {
    $scope.savedItems = $StoredDataService;
    $scope.select = function(item){
        $RegexpValues.updateCurrent(item);
        $SyncService.sync();
    };
    $timeout(function(){
        $StoredDataService.restore();
    },0);
}
AsideController.$inject = ['$scope', '$StoredDataService','$timeout','$RegexpValues','$SyncService'];