var regexpDirectives = angular.module('regexp.dirctive', []);

regexpDirectives.directive('fullHeight', ['$window', '$timeout', function($window, $timeout) {
    return {
        restrict: 'A',
        scope: {
            html: '=html'
        },
        template: '<div ng-bind-html="html"></div>',
        link: function(scope, element) {
            
            var setResultsBoxSize = function(){
                var h = $window.innerHeight;
                var box = element[0].getBoundingClientRect();
                var top = box.top;
                element[0].style.height = (h - top) + 'px';
            };
            $window.addEventListener('resize', function(e) {
                setResultsBoxSize();
            }, false);
            element.css('overflow','auto');
//            $timeout(function(){
//                setResultsBoxSize();
//            },100);
            scope.$watch('html', function(newValue, oldValue) {
                if (newValue === oldValue)
                    return;
                setResultsBoxSize();
            });
        }
    };
}]);