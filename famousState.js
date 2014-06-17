$FamousStateProvider.$inject = ['$rootScope', '$http', '$q'];
function $FamousStateProvider() {

  var states = {};
  var queue = {};
  var $famousState = {};

  this.state = state;
  function state(name, definition) {
    definition.name = name;
    defineState(definition);
    return this;
  }

  function defineState(state) {
    
    var name = state.name;
    if ( typeof(name) !== 'string' || name.indexOf('@') >= 0)  {
      throw new Error('State must have a valid name');
    }
    if (states.hasOwnProperty(name)) {
      throw new Error('State ' + name + ' is already defined');
    }

    // Parent state may be defined within the name of the child state or as a separate property
    var parentName = (name.indexOf('.') !== -1) ? name.substring(0, name.lastIndexOf('.'))
        : (typeof(state.parent) === 'string') ? state.parent
        : '';

    if ( !!parentName && !states[parentName] ) { return queueState(state); } 

    buildState(state);

  }

  function buildState (state) {

    for ( var key in stateBuilder ) {
      stateBuilder[key](state);
    }

    registerState(state);
    updateQueue();

  }

  var stateBuilder = {

    template: function(state) {

      var template;
      if ( !!state.templateUrl ) {
        template = state.templateUrl;

        if ( typeof template !== 'string' || template.substr(-5) !== '.html' ) {
          throw new Error('templateUrl must be a string pointing to an HTML document (e.g. templates/myTemp.html)');
        }

        var promise = fetchTemplate(name, template);

        promise.then(function(templateHTML) {
          $templateCache.put(state.name, templateHTML);
          state.template = templateHTML;
        }, function(reason) {
          throw new Error('Failed to fetch template for ' + state.name + '. ' + reason);
        });

      } else if ( !!state.template ) {
        template = state.template;
        $templateCache.put(name, template);
      }

    },

    controller: function(){

      if ( !!state.template  && !!controller ) { 
        throw new Error('A template must defined in order to create a controller');
      } 

      var newScope = $rootScope.new();
      
      var controller = state.controller;

      if ( typeof controller === 'string' ) {
        $controller(controller);
      } else if ( typeof contoller === 'function' ){
        $controller(controller, {$scope: newScope});
      }
    },

    transitions: function(state) {
      //should be a function that returns a transition(I think)
      var inTransition = state.inTransition;
      var outTransition = state.outTransition;

      if ( !!inTransition  ){
        state.inTransition = typeof inTransition === 'function' ? inTransition() : 'default'; 
      } 

      if ( !!outTransition  ){
        state.outTransition = typeof outTransition === 'function' ? outTransition() : 'default'; 
      } 
    }

  };

  function registerState(state) {
    var name = state.name;
    delete state.name;
    states[name] = state;
  }

  function queueState(state) {
    if ( !!queue[state.name] ) {
      queue[state.name] = state;
    }
  }

  function updateQueue(){
    for ( var name in queue ) {
      defineState(queue[name]);
    }
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

  $famousState.current = ''; // Name of the current state
  $famousState.$current = {}; // Current state object
  $famousState.$previous = {}; // Prior state object
  
  $famousState.$go = function(state){

    if ( states[state] ) {
      $famousState.$prior = states[state]; // Set prior to the state object being transitioned out
      $famousState.current = state; // Update with the name of the current state
      $famousState.$current = states[state]; // Update with the current state object
      $rootScope.$broadcast('$stateChangeSuccess');
    } else {
      $rootScope.$broadcast('$stateNotFound');
    }
  };

  this.$get = $get;
  $get.$inject = ['$rootScope', '$q', '$http', '$view', '$injector', '$resolve', '$stateParams', '$location', '$urlRouter', '$browser'];
  this.$get = function(){    

    return $famousState;

  };
  
}

// angular.module('fa.router.state')
//   .value('$stateParams', {})
//   .provider('famousState', $famousStateProvider);



