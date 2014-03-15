var regexpApp = angular.module('regexpApp', [
  'regexp.service',
  'regexp.dirctive',
  'ui.bootstrap.tabs',
  'ui.bootstrap.modal',
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
  });