var regexpApp = angular.module('regexpApp', [
  'regexp.service',
  'regexp.dirctive',
  'ui.bootstrap.tabs',
  'ui.bootstrap.modal',
  'ui.bootstrap.position',
  'ui.bootstrap.popover',
  'ui.bootstrap.tooltip',
  'ui.bootstrap.bindHtml',
  'ui.bootstrap.alert',
  'ngSanitize',
  'xc.indexedDB'
]);


regexpApp.config(function ($indexedDBProvider) {
      $indexedDBProvider
        .connection('regexpStorage')
        .upgradeDatabase(1, function(event, db, tx){
            try{
                db.deleteObjectStore('regexp_store');
            } catch(e){};
            var objStore = db.createObjectStore('regexp_store', {keyPath: 'regexp'});
//            objStore.createIndex('url_idx', 'url', {unique: false, multiEntry: false});
        });
  })
.constant('APP_EVENTS', {
    errorOccured: 'app-error-occured',
    regexpValuesSynced: 'app-regexp-values-synced',
    regexpValuesSaved: 'app-db-saved'
});