/**
 * The following features are still outstanding: popup delay, animation as a
 * function, placement as a function, inside, support for more triggers than
 * just mouse enter/leave, html popovers, and selector delegatation.
 */
angular.module('ui.bootstrap.popover', ['ui.bootstrap.tooltip'])

.directive('popoverPopup', function() {
    return {
        restrict: 'EA',
        replace: true,
        scope: {title: '@', content: '@', placement: '@', animation: '&', isOpen: '&'},
        templateUrl: 'lib/angular-1.2.0/ui/popover/popover.html'
    };
})

.directive('popover', ['$tooltip', function($tooltip) {
        return $tooltip('popover', 'popover', 'click');
    }]);