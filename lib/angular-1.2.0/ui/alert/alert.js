angular.module('ui.bootstrap.alert', [])

    .controller('AlertController', ['$scope', '$attrs', function($scope, $attrs) {
        $scope.closeable = 'close' in $attrs;
    }])

    .directive('alert', function() {
        return {
            restrict: 'EA',
            controller: 'AlertController',
            templateUrl: 'lib/angular-1.2.0/ui/alert/alert.html',
            transclude: true,
            replace: true,
            scope: {
                type: '@',
                close: '&'
            }
        };
    });