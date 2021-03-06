/**
 * @ngdoc provider
 * @name $famousStateProvider
 * @module famous.angular
 * @description
 * This provider allows for state-based routing similar to that of the Angular UI Router.  The 
 * difference being that $famousStateProvider allows Famo.us animations and transforms to be defined on
 * state transitions.
 *
 * @usage
 * States may defined in the following manner:
 *
 * ```js
 * angular.module('mySuperApp', ['famous.angular']).config(
 *   function($famousStateProvider) {
 *    $famousStateProvider
 *      .state('home', {
 *        url: '/',
 *        templateURL: 'views/home.html',
 *        conroller: 'homeCtrl',
 *        inTransitionFrom: {
 *          contact: 'fromContact'
 *          portfolio: 'fromPortfolio'  
 *        },
 *        outTransitionTo: {
 *          contact: 'toContact'
 *          portfolio: 'toPortfolio'
 *        }
 *      })
 *      .state('portfolio', {
 *        url: '/portfolio',
 *        controller: function($scope) { $scope.name = 'My Portfolio'; },
 *        inTransitionFrom: {
 *          home: 'fromHome',
 *          contact: 'fromContact'  
 *        },
 *        outTransitionTo: {
 *          home: 'toHome',
 *          contact: 'toContact'
 *        },
 *        views: {
 *          '': {templateUrl: 'views/portfolioMain.html},
 *          'project1@portfolio': {templateUrl: 'views/portfolioProject1.html},
 *          'project2@portfolio': {templateUrl: 'views/portfolioProject2.html}
 *        }
 *      });
 *      .state('contact', {
 *        url: '/contact',
 *        template: '<p>Contact us at contact@examples.com</p>',
 *        controller: 'contactCtrl'
 *      });
 *   }
 * });
 * ```
 *
 */

angular.module('famous.angular')

  .provider('$famousState', function() {
    
    var states = {};
    var queue = {};
    var $famousState;
    var root;

    /**
     * @ngdoc method
     * @name $famousProvider#state
     * @module famous.angular
     * @description
     * Defines the states of the application
     * @param {String} definition Defines the name of the state
     * @param {Object} definition Defines the parameters of the state
     */

    this.state = state;
    function state(name, definition) {
      /** 
       * If only a single state definition object is passed as a parameter, will
       * attempt to extract the state name from the parameter object 
       */
      if ( angular.isObject(name) ) {
        definition = name;
      } else {
        definition.name = name;
      }
      defineState(definition);
      return this;
    }

    /**
     * Validates the name and parent of the state object being created.
     */
    function defineState(state) {
      
      // Static child views may be defined using '@child@parent'
      var name = state.name;
      if ( !angular.isDefined(name) || !angular.isString(name) || name.indexOf('@') >= 0  || name.indexOf('.') !== -1 )  {
        throw new Error('State must have a valid name');
      }
      if (states.hasOwnProperty(name)) {
        throw new Error('State ' + name + ' is already defined');
      }

      // Parent state may be defined within the name of the child state or as a separate property
      var parentName = (name.indexOf('.') !== -1) ? name.substring(0, name.lastIndexOf('.'))
          : ( angular.isString(state.parent) ) ? state.parent
          : '';

      if ( !!parentName && !states[parentName] ) { return queueState(state); }
      
      buildState(state);
    }

    /**
     * Passes the state object into the state builder which validates each of the properties defined
     * on the state.  If the object "passes" the state builder, it will be registered (added to the 
     * states object).  Finally, updateQueue is invoked to determine whether or not the state being 
     * added is the parent of one of the "orhpan" states in the queue.  If so, the child state will be 
     * registered.
     */
    function buildState (state) {
      
      angular.forEach(stateBuilder, function(buildFunction) {
        buildFunction(state);
      });

      registerState(state);
      updateQueue(state);
    }

    /**
     * Validates each of the propeties on the state object before the state is registered.
     */
    var stateBuilder = {
      
      // Extracts the name of the parent if implicitly ('parent.child') defined on the parent property
      parent: function(state) {
        if ( angular.isDefined(state.parent) && state.parent ) { return; }
        
        // Extract parent name from composite state name: grandparent.parent.child -> grandparent.parent 
        var compositeName = /^(.+)\.[^.]+$/.exec(state.name);
        state.parent = compositeName ? compositeName[1] : root;
      },
 
      url: function(state) {
        
        var url = state.url;

        if ( !angular.isDefined(url) ) { return; }
        if ( !angular.isString(url) ) { throw new Error('url for state ' + state.name + ' must be a string'); }
        
      },
      
      // Template should be a string or a link to an HTML document
      template: function(state) {

        var template;
        if ( !!state.templateUrl ) {
          template = state.templateUrl;
          if ( !angular.isString(template) || template.substr(-5) !== '.html' ) {
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
      
      // An anonymous function or a string referring a controller to be defined within the application
      controller: function(state){
       
        var controller = state.controller;
        if ( (!state.template && !angular.isDefined(state.views)) && !!controller ) { 
          throw new Error('A template must defined in order to create a controller');
        } 
        if ( !!controller && !angular.isString(controller) && !angular.isFunction(controller) ) {
          throw new Error('Controller must be a function or reference an existing controller');
        } 
      },

      /**
       * Transitions are objects that define how one state should transfer to and from all other states
       * in the application.  The keys in a transition object should be the name of the states being
       * transitioned to/from and the value should be a string which references the name of a function
       * in the controller that defines the transition.  A single transition function may also be passed,
       * thereby assigning a single transition to/from that state.  If no transitions are definec, default
       * transitions will be assigned.
       */
      transitions: function(state) {

        if ( !angular.isDefined(state.inTransitionFrom) && !angular.isDefined(state.outTransitionTo) ) { return; } 
        
        var transitions = {}; 
        transitions.inTransitionFrom = state.inTransitionFrom;
        transitions.outTransitionTo = state.outTransitionTo;
 

        for ( var direction in transitions ) {
          if ( angular.isString(transitions[direction]) ) {
            // '($callback)' must be added to the function to create an invocation that can be properly parsed
            state[direction] = transitions[direction] + '($callback)'; 
          } else if ( angular.isObject(transitions) ) {
            angular.forEach(transitions[direction], function(definition, state) {
              transitions[direction][state] = definition + '($callback)';
            })
            angular.extend(state[direction], transitions[direction]);
          } else if ( angular.isDefined(state[direction]) ) { 
            throw new Error('Transitions must be strings which reference function names');
          }
        }
      },
      
      // Static views should be defined using 'staticChild@parent' notation
      views: function(state) {

        if ( !angular.isDefined(state.views) ) { 
          state.views = { '@': state };
          return;
        }

        var views = {};

        angular.forEach(angular.isDefined(state.views) ? state.views : { '': state }, function (view, name) {
          if ( !name ) { name = '@'; }
          if ( name.indexOf('@') === -1 ) { name += '@' + state.parent.name; }
          validateView(view, name);
          views[name] = view;
        });

        state.views = views;
      },

      /**
       * Creates a locals object which contains all data relevant to the child views the states
       */
      locals: function(state) {

        state.locals = {};
        
        angular.forEach(state.views, function(view, name) {
          if ( name !== '@' ) { state.locals[name] = view; }
        });
      }

    };

    /**
     * Static views are similar to states in that they may have their own templates, controllers,
     * and transitions defined.  Accordingly, all properties must be defined in the same manner. 
     */
    function validateView (view) {
      
      stateBuilder.template(view);
      stateBuilder.controller(view);
      stateBuilder.transitions(view);
    }

    /**
     * Adds the state to the states object which stores all valid registered states
     */
    function registerState(state) {

      var name = state.name;
      states[name] = state;
    }

    /**
     * Adds an "orphan" child state to the queue if it doesn't already exist within the queue
     */
    function queueState(state) {
      if ( !queue[state.name] ) {
        queue[state.name] = state;
      }
    }

    /**
     * Removes state from the queue if it is no longer an "orphan."" Iterates through 
     * the "orphan" queue ito determine is the parent of any of the child states has been registered.  
     * If so, the child state is registered.
     */
    function updateQueue(state){
      if ( queue[state.name] ) { delete queue[state.name]; }
      for ( var name in queue ) {
        defineState(queue[name]);
      }
    }

    root = {
      name : '',
      url: '^',
      parent: null,
      views: null,
      template: null,
      contoller: null,
      locals: null
    };
    
    this.$get = $get;
    $get.$inject = ['$rootScope','$http', '$location', '$q', '$famousTemplate'];
    function $get($rootScope, $http, $location, $q, $famousTemplate) {

      /**
       * @ngdoc service
       * @name $famousState
       * @module famous.angular
       * @description
       * This service gives you access to $famousState object.
       *
       * @usage
       * Use this service to transition states and access information related to the current state.
       *
       * ```js
       * angular.module('mySuperApp', ['famous.angular']).controller(
       *   function($scope, $famousState) {
       *
       *     // Transition states
       *     $scope.goHome = function() {
       *       $famousState.go('home');
       *     };
       *     // Access information related to current state
       *     $famousState.current = 'The name of the current state';
       *     $famousState.$current = 'The current state object';
       *     $famousState.locals = 'The properties of any static child views defined on the state';
       *     $famousState.$prior = 'The previous state of the application;
       *     $famousState.inTransitionTo = 'The in transitions assigned to the current state';
       *     $famousState.outTransitionFrom = 'The out transitions assigned to the current state';
       *   }  
       * });
       * ```
       *
       */

      $famousState = {
        current: root.name, // Name of the current state
        $current: root,
        parent: root.parent,
        locals: {},
        $prior: {}, // Prior state object
        inTransitionTo: '',
        outTransitionFrom: ''
      };

      /**
       * @ngdoc method
       * @name $famousState#includes
       * @module famous.angular
       * @description
       * Allows the $famousState object to be queried to determine whether or not a state is registered.
       * @param {String} state The name of a state
       * @returns {Boolean} A boolean indicating whether or not the state is registered
       */
      $famousState.includes = function(state) {  
        return stateValid(state);
      };

      /**
       * @ngdoc method
       * @name $famousState#go
       * @module famous.angular
       * @description
       * Initiates the state transition process.  Return if state is the current state and reload is not true.
       * @param {String} state The name of a state
       * @returns {Object} The $famousState object
       */
      $famousState.go = function(state, reload){
        if ( state === $famousState.current && !reload) { return; }
        transitionState(state);     
      };

      /**
       * @ngdoc method
       * @name $famousState#getStates
       * @module famous.angular
       * @description
       * Returns all currently registered states.  This function exists solely for the purpose of 
       * allowing the famousUrlRouter to update URL routes upon initiation.  As soon as the dependency
       * injection issue is resolved, this function may be deleted.
       * @param {String} state The name of a state
       * @returns {Object} The states object
       */

      $famousState.getStates = function() {
        return states;
      };

      // Updates the $famousState object so that the new state view may be rendered by the fa-router directive
      function transitionState(state) {
        state = transferValid(state);
        if ( !state ) { return $rootScope.$broadcast('$stateNotFound'); }

        $famousState.$prior = $famousState.$current;
        $famousState.current = state;
        $famousState.$current = states[state];
        $famousTemplate.resolve($famousState.$current)
        .then(function(template){
          $famousState.$current.$template = template;
          $rootScope.$broadcast('$stateChangeSuccess');
          if ( !!$famousState.$current.url ) { 
            $location.path($famousState.$current.url); }
        });
      }

      /**
       * Validates the name (or relative name) of the state parameter passed to '$famousState.go'
       * @param {String} state The name (or relative name) of a state
       * @returns {Boolean} Returns a value indicating whether or not the state is valid 
       */
      function transferValid(state) {

        // '^' indicates that the parent state should be activated
        if ( state === '^' ) { 
          var parent = /^(.+)\.[^.]+$/.exec($famousState.current)[1];
          return stateValid(parent) ? parent : false;
        }

        // '^.name' indicates that a sibling state should be activated
        if ( state.indexOf('^') === 0 && state.length > 1 ) {
          state = $famousState.$current.parent + state.slice(1);
          return stateValid(state) ? state : false;
        }
        
        // '.name' indicates that a child state should be activated
        if ( state.indexOf('.') === 0 ) {
          state = $famousState.current + state;
          return stateValid(state) ? state : false;
        }
        
        /**
         * In order for a child state to be activated, the parent state of that child must first be active.  
         * If the parent is not active, the closest commong ancestor of the two states will be found and 
         * the child of the common ancestor which is along the same path as the requested state will be activated.
         * If a common ancestor does not exists, the highest-level ancestor of the requested state will be 
         * activated.  
         * 
         * Example: The current state is 'A.E.F.X' and $famousState.go('A.E.B.Q') is called. 'A.E.B.Q' cannot 
         * be activated without 'A.E.B' first being active.  Since 'A.E' is part of the path of the currently 
         * active state, 'A.E.B' will be activated.  
         * 
         * Example: The current state is 'B.C.E' and $famousState.go('A.D') is called.  Since the two states do
         * not share a common ancestor, the highest-level ancestor of the requested state, 'A', will be activated.
         */
        if ( state.indexOf('.') > 0 ) {
          if ( $famousState.current === '' ) { $location.path('^'); }
          var parentName = /^(.+)\.[^.]+$/.exec(state)[1];
          if ( $famousState.current === parentName ) {
            return stateValid(state) ? state : false;
          } else {
            var relativeState  = findCommonAncestor(parentName);
            return stateValid(relativeState) ? relativeState : false;
          }
        }

        return stateValid(state) ? state: false;
      }

      /**
       * Accepts the parent name of a state and finds the closest common ancestor of the currently active state.
       * If an ancestor is found, the child state of the ancestor which corresponds to the state passed into the
       * the function will be returned.  If there is no common index, the highest-level ancestor of the passed in
       * state will be returned.  
       */
      function findCommonAncestor (parentName) {
        
        var currentParent = $famousState.$current.parent;
        var newParent = parentName;
        var newChild;
        
        while (currentParent && newParent) {

          if ( currentParent.indexOf('.') !== -1 && currentParent.length >= newParent.length ) {
            currentParent = /^(.+)\.[^.]+$/.exec(currentParent)[1];
          }
          if ( newParent.indexOf('.') !== -1 && newParent.length > currentParent.length ) {
            newChild = newParent.slice(newParent.lastIndexOf('.'));
            newParent = /^(.+)\.[^.]+$/.exec(newParent)[1];
          }
          if ( currentParent === newParent || currentParent.indexOf('.') === -1 && newParent.indexOf('.') === -1  ) { break; }

        }

        return newParent + newChild;
      }

      /**
       * Returns a boolean indicating whether or not the state is registered
       */
      function stateValid (state) {
        return ( !!states[state] );
      }

      return $famousState;
    }   
});