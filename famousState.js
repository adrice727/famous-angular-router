$FamousStateProvider.$inject = ['$rootScope', '$http', '$q'];
function $FamousStateProvider() {

  var states = {};
  var queue = {};
  var $famousState = {};

  this.state = state;
  function state(name, definition) {
    
    if ( typeof name === 'object' ) {
      definition = name;
    } else {
      definition.name = name;
    }

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
        state.template = {link: template};

      } else if ( !!state.template ) {
        template = state.template;
        if ( typeof template !== 'string' ){
          throw new Error('template must be a string containing valid HTML');
        }
        state.template = {html: template};
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

  function fetchTemplate(state) {
    if ( state.template.html ) {
      return state.template.html;
    } else {
      return $http
              .get(state.template.link, { cache: $templateCache })
              .then(function(response) { return response.data; });
    }
  }
  
  $famousState.current = ''; // Name of the current state
  $famousState.$current = {}; // Current state object
  $famousState.$previous = {}; // Prior state object
  
  $famousState.includes = function(state) {
    return states[state]? true : false;
  };


  $famousState.go = function(state, params, options){

    if ( states[state] ) {
      $famousState.$prior = $famousState.$current;
      $famousState.state = state;
      $famousState.$current = states[state];
      $state.$template = fetchTemplate($famousState.$current);
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



