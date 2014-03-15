var regexpDirectives = angular.module('regexp.dirctive', []);

regexpDirectives.directive('fullHeight', ['$window', function($window) {
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
            
            element.css('overflow','auto');
            scope.$watch('html', function(newValue, oldValue) {
                if (newValue === oldValue)
                    return;
                setResultsBoxSize();
            });
            
            $window.addEventListener('resize', setResultsBoxSize, false);
            scope.$on('$destroy', function onDestroyElement() {
                $window.removeEventListener('resize', setResultsBoxSize, false);
            });
        }
    };
}]);