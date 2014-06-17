$FamousStateProvider.$inject = ['$rootScope', '$http', '$q'];
function $FamousStateProvider() {

  var states = {}, $famousState, queue = {};

  this.state = state;
  function state(name, definition) {
    definition.name = name;
    defineState(definition);
    return this;
  }

  function defineState(state) {

    // Get state name
    var name = state.name;
    if ( typeof(name) !== 'string' || name.indexOf('@') >= 0)  {
      throw new Error('State must have a valid name');
    }
    if (states.hasOwnProperty(name)) {
      throw new Error('State ' + name + ' is already defined');
    }

    // Get parent name, if parent
    var parentName = (name.indexOf('.') !== -1) ? name.substring(0, name.lastIndexOf('.'))
        : (typeof(state.parent) === 'string') ? state.parent
        : '';

    if ( !!parentName && !states[parentName] ) { return queueState(state); }   

    //Get template

    var template;
    if ( !!state.templateUrl ) {
      template = state.templateUrl;

      if ( typeof template !== 'string' || template.substr(-5) !== '.html' ) {
        throw new Error('templateUrl must be a string pointing to an HTML document (e.g. templates/myTemp.html)');
      }

      var promise = fetchTemplate(name, template);

      promise.then(function(stateName, templateString) {
        $templateCache.put(stateName, templateString);
      });

    } else if ( !!state.template ) {
      template = state.template;
      $templateCache.put(name, template);
    }

    if ( !!template  && !!controller ) { 
      throw new Error('A template must defined in order to create a controller');
    } 

    var newScope = $rootScope.new();
  
    var controller = state.controller;

    if ( typeof controller === 'string' ) {
      $controller(controller);
    } else if ( typeof contoller === 'function' ){
      $controller(controller, {$scope: newScope});
    }

    var inTransition; //should be a function that returns a transform
    var outTransition; //should be a function that returns a transform


    registerState(state);
    
    checkQueue();
  }

  function queueState(state) {
    if ( !!queue[state.name] ) {
      queue[state.name] = state;
    }
  };

  function checkQueue(){
    forEach(queue, function(value, key)) {
      buildstate(value);
    }
  }

  function registerState(state) {
    var key = state.name;
    delete state.name;
    states[key] = state;
  }

  function fetchTemplate(stateName, templateUrl) {
    var deferred = $q.defer();

    $http.get(templateUrl).success(function(data, status) {
      deferred.resolve(data);
    }).error(function(data, status) {
      deferred.reject(data);
    });

    return deferred.promise;

    }
  }



    $famousState.$current = {}; //Return current state object
    $famousState.$previous = {}; //Prior state object
    $famousState.$go = function(state){

      //Check if the passed in state exists
      //  if not, $rootScope.$broadcast('$stateNotFound')
      //  if found, $rootScope.$broadcast('stateChangeStart')
      //in ui router, this method call $state.transistionTo

    };
    $famousState.current = 'current state';  //This will be a string;
  

  this.$get = $get;
  $get.$inject = ['$rootScope', '$q', '$http', '$view', '$injector', '$resolve', '$stateParams', '$location', '$urlRouter', '$browser'];
  this.$get = function(){    

    return $state;

  };

};


angular.module('fa.router.state')
  .value('$stateParams', {})
  .provider('famousState', $famousStateProvider);

  // var stateBuilder = {
    
  //   setUrl: function(state) {
  //     var url = state.url;

  //     if (isString(url)) {
  //       if (url.charAt(0) == '^') {
  //         return $urlMatcherFactory.compile(url.substring(1));
  //       }
  //       return (state.parent.navigable || root).url.concat(url);
  //     }

  //     if ($urlMatcherFactory.isMatcher(url) || url == null) {
  //       return url;
  //     }
  //     throw new Error('Invalid url ' + url + ' in state ' + state + '');
  //   },

  //   setTemplate: function(state) {


  //   },

  //   setContoller: function(state) {
      
  //     var controller = state.controller;
  //     if ( typeof controller !== 'string' || typeof controller !== 'function' ) throw new Error('Controller must be a string or function');

  //     var newScope = $rootScope.$new();
  //     controller = $controller(state.controller, {$scope: newScope});
  //   }, 

  //   setTransitions: function(state) {


  //   }
  // }
