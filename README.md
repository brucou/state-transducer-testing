**TODO** pending isolating the portion only related to testing

| **Describe events progressing the machine**| **Get your tests generated for you!** |
|:---:|:---:|
| ![password selector test generation](assets/password%20selector%20test%20generation.png)| <img src="https://github.com/brucou/state-transducer/raw/WIP/assets/password%20selector%20test%20generated.png" width="450" heigth="200"/>|

[![npm version](https://badge.fury.io/js/state-transducer.svg)](https://badge.fury.io/js/state-transducer-testing)
![](https://img.shields.io/bundlephobia/minzip/state-transducer-testing.svg)
![](https://img.shields.io/github/license/brucou/state-transducer-testing.svg)
![Contributions welcome](https://img.shields.io/badge/contributions-welcome-orange.svg)

# Table of Contents
- [Features](#features)
- [Examples](#examples)
- [Motivation](#motivation)
- [The link between state machines and user interfaces](#the-link-between-state-machines-and-user-interfaces)
- [Install](#install)
- [Tests](#tests)
- [Integration with React](#integration-with-react)
- [API](#api)
  * [API design](#api-design)
  * [General concepts](#general-concepts)
  * [Transducer semantics](#transducer-semantics)
  * [`createStateMachine :: FSM_Def -> Settings -> FSM`](#-create-state-machine----fsm-def----settings----fsm-)
  * [`traceFSM :: Env -> FSM_Def -> FSM_Def`](#-tracefsm----env----fsm-def----fsm-def-)
  * [`generateTestSequences :: FSM_Def -> Generators -> GenSettings -> Array<TestCase>`](#-generatetestsequences----fsm-def----generators----gensettings----array-testcase--)
- [Possible API extensions](#possible-api-extensions)
- [Visualization tools](#visualization-tools)
- [References](#references)
- [Roadmap](#roadmap)
- [Who else uses state machines](#who-else-uses-state-machines)
- [Annex](#annex)
  * [So what is an Extended Hierarchical State Transducer ?](#so-what-is-an-extended-hierarchical-state-transducer--)
  * [Terminology](#terminology)

# Features
- **small size** : tree-shakeable implementation, 5k for the core, 9k including tracing and testing
- **small API** : one function for the state machine, one function for the test generation, one 
function for tracing
- **just a function!** : easy to integrate into any framework
- **automatic test generation!** : write the machine, how to progress from one state to another, 
and let the computer generate hundreds of tests for you

# Examples
- [password meter component](https://codesandbox.io/s/73wy8jwk86)
- [movie database search interface](https://codesandbox.io/s/mo2p97k7m8) 
- [wizard forms](https://github.com/brucou/cycle-state-machine-demo/tree/first-iteration-fix)

# Motivation
Time and again we have to implement computations which, while they cannot be modelized by pure 
functions, however have the following interesting properties :

- they transform an input into an output, depending only on the present and past inputs
- they do not perform any effects
- the algorithm for the computation involves a finite, parameterizable set of rules, coalescing  
around a finite, fixed set of control states

These computations can be modelized by a class of state machines called 
hierarchical extended [state transducer](https://en.wikipedia.org/wiki/Finite-state_transducer). 
This library offers a way to define, and use such class of state machines. Most of the time, we 
will call them just state machines instead of the more accurate state transducer term.

Now, the whole thing can sound very abstract but the major motivation for this library has been the 
specification and implementation of user interfaces. As a matter of fact, to [every user 
interface can be associated a computation](https://brucou.github.io/posts/user-interfaces-as-reactive-systems/#reactive-systems-as-automata) 
relating inputs to the user interface to an action to be performed on the interfaced systems. That 
computation often has a logic [organized around a limited set of control states](#base-example). Exactly what
 we just wrote about. [**Jump to the examples**](https://github.com/brucou/state-transducer#general-concepts).

This library is born from :

- the desire to apply such tool for both specification and implementation of user interfaces
- the absence of existing javascript libraries which satisfy our [design criteria](https://github.com/brucou/state-transducer#api-design)
  - mostly, we want the state machine library API design to be as close as possible from the 
  mathematical object denoting it. This should allow us to reason about it, compose and reuse 
  it easily. 
  - most libraries we found either do not feature hierarchy in their state machines, or use a 
  rather imperative API, or impose a concurrency model on top of the state machine's control flow

This is a [work in progress](#roadmap), however the main API for the v1.0 should be relatively 
stable. Changes for the test API are to be expected though.

It works nicely and have already been used succesfully for user-interfaces as well as in other 
contexts:

- in multi-steps workflows: see an example [here](https://github.com/brucou/component-combinators/tree/master/examples/volunteerApplication), a constant feature of enterprise software today
- for ['smart' synchronous streams](https://github.com/brucou/partial-synchronous-streams), which
 tracks computation state to avoid useless re-computations
- to implement cross-domain communication protocols, to coordinate iframes with a main window

In such cases, we were able to modelize our computation with an Extended Hierarchical State Transducer 
in a way that :

- is economical (complexity of the transducer proportional to complexity of the computation)
- is reasonably easy to reason about and communicate (the transducer can
 be visually represented, supporting both internal and external communication, and design 
 specification and documentation)
- supports step-wise refinement and iterative development (control states can be refined into a 
hierarchy of nested states)

# The link between state machines and user interfaces
In short :

- a user interface can be specified by a relation between events received by the user 
interfaces and actions to be performed as a result on the interfaced system. 
- Because to the same triggering event, there may be different actions to perform on the 
interfaced system (depending for instance on when the event did occur, or which other events 
occured before), we use state to represent that variability, and specify the user interface with 
a function `f` such that `actions = f(state, event)`. We call here `f` the reactive function for the user interface.
- The previous expression suffices to specify the user interface's behaviour, but is not enough 
to deduce an implementation. We then use a function `g` such that `(actions_n, state_{n+1} = g
(state_n, event_n)`. That is, we explicitly include the modification of the state triggered by 
events. Depending on the choice that is made for `state_n`, there is an infinite number of ways 
to specify the user interface.
- a state machine specification is one of those ways with some nice properties (concise 
specification, formal reasoning, easy visualization). It divides the state into control states and 
extended state. For each control state, it specifies a reactive sub-function which returns an 
updated state (i.e. a new control state, and a new extended state) and the actions to perform on 
the interfaced system.

Let's take a very simple example to illustrate these equations. The user interface to 
specify is a [password selector](https://cdn.dribbble.com/users/522131/screenshots/4467712/password_strength.png). Visually, the user interface consists of a passowrd input field 
and a submit password button. Its behaviour is the following :
- the user types
- for each new value of the password input, the input is displayed in green if the password is 
strong (that will be, to remain simple if there are both letters and numbers in the password), and
 in red otherwise
- if the password is not strong, the user click on `set password` button is ignored, otherwise 
the password is set to the value of the password input
 
A `f` partial formulation :

|State|Event|Actions|
|---|---|---|
|`{input: ""}`|*typed `a`*|display input in red|
|`{input: "a"}`|*typed `2`*|display input in green|
|`{input: "a2"}`|*clicked submit*|submit `a2` password|
|`{input: "a"}`|*typed `b`*|display input in red|
|`{input: "ab"}`|*clicked submit*|---|

A `g` partial formulation :

|state_n|event|actions_n|state_{n+1}|
|---|---|---|---|
|`{input: ""}`|*typed `a`*|display input in red|`{input: "a"}`|
|`{input: "a"}`|*typed `2`*|display input in green|`{input: "a2"}`|
|`{input: "a2"}`|*clicked submit*|submit `a2` password|`{input: "a2"}`|
|`{input: "a"}`|*typed `b`*|display input in red|`{input: "ab"}`|
|`{input: "ab"}`|*clicked submit*|---|`{input: "ab"`}|

A state machine partial formulation :

|Control state|Extended state|Event|Actions|New control state|New extended state|
|---|---|---|---|---|---|
|**Weak**|`input: ""`|typed `a`|display input in red|**Weak**|`input: "a"`|
|**Weak**|`input: "a"`|typed `2`|display input in green|**Strong**|`input: "a2"`|
|**Strong**|`input: "a2"`|clicked submit|submit `a2` password|**Done**|`input: "a2"`|
|**Weak**|`input: "a"`|typed `b`|display input in red|**Weak**|`input: "ab"`|
|**Weak**|`input: "ab"`|clicked submit| - |**Weak**| `input: "ab"` |

The corresponding implementation is by a function `fsm` with an encapsulated internal state of 
`{control state : weak, extended state: {input : ''}}` such that, if the user types 'a2' and 
clicks submit :

```
fsm(typed 'a') = nothing
fsm(typed '2') = nothing
fsm(clicked submit) = submit `a2` password
```

The corresponding visualization (actions are not represented) :

![password submit fsm](assets/password%20submit%20fsm.png)

Note that we wrote only partial formulations in our table, as the sequence of inputs by the user 
is potentially infinite (while this article is not). Our tables do not for instance give a 
mapping for the following sequence of events : `[typed 'a', typed '2', typed 
 '<-|']`. Conversely, our state machine concisely represents the fact that whatever input we 
 receive in the `Weak` control state, it will only go to the `Strong` control state if some 
 pre-configured condition are fulfilled (both numbers and letters in the password). It will 
 only submit the password if the `clicked submit` event is received while it is in the `Strong` 
 state.
 The starting state and these two assertions can be combined into a theorem : the machine will only 
 submit a password if the password is strong. In short, we are able to reason formally about the 
 machine and extract properties from its definition. This is just one of the many attractive properties of state 
  machines which makes it a tool of choice for robust and testable user interface's implementation.

For the modelization of a [much more complex user interface](https://sarimarton.github.io/tmdb-ui-cyclejs/dist/#/), and more details on the benefits of state machine, I'll refer the reader to a [detailed article](https://github.com/brucou/movie-search-app/blob/specs-all/article/article.md) I wrote on the subject.
 
# Install
`npm install state-transducer --save`

# Tests
Automated tests are close to completion. Contracts are so far not enforced. To run the 
current automated tests, type in a terminal : `npm run test`

# Integration with React
The machine is just a function. As such it is pretty easy to integrate in any framework. As of 
today, we provide the following integrations :

- [integration with React](https://github.com/brucou/react-state-driven) 
  - using state machines allows to use React mostly as a DOM library and eliminates the need for 
  state management, HOC, hooks and other react advanced concepts.

# API
## API design
The key objectives for the API was :

- generality, reusability and simplicity 
  - there is no explicit provision made to accommodate specific use cases or frameworks
  - it must be possible to add a [concurrency and/or communication mechanism](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.92.6145&rep=rep1&type=pdf) on top of the current design
  - it must be possible to integrate smoothly into React, Angular and your popular framework
  - support for both interactive and reactive programming
- parallel and sequential composability of transducers

As a result of this, the following choices were made :

- functional interface : the transducer is just a function. As such, the 
transducer is a black-box, and only its computed outputs can be observed
- complete encapsulation of the state of the transducer
- no effects performed by the machine
- no exit and entry actions, or activities as in other state machine formalisms
  - there is no loss of generality as both entry and exit actions can be implemented with our 
  state transducer. There is simply no syntactic support for it in the core API. This can however be
   provided through standard functional programming patterns (higher-order functions, etc.)
- every computation performed is synchronous (asynchrony is an effect)
- action factories return the **updates** to the extended state to avoid any 
unwanted direct modification of the extended state (API user must provide such update function, 
which in turn allows him to use any formalism to represent state - for instance `immutable.js`)
- no restriction is made on output of transducers, but inputs must follow some conventions (if a
 machine's output match those conventions, two such machines can be sequentially composed
- parallel composition naturally occurs by feeding two state machines the same input(s))
- as a result, reactive programming is naturally enabled. If inputs is a stream of 
well-formatted machine inputs, and `f` is the fsm, then the stream of outputs will be `inputs.map
(f)`. It is so simple that we do not surface it at the API level

Concretely, our state transducer will be created by the factory function `createStateMachine`, 
which returns a state transducer which :

- immediately positions itself in its configured initial control state 
- will compute an output for any input that is sent to it since that

Let us insist again on the fact that the state transducer is not, in general, a pure function of 
its inputs. However, a given output of the transducer depends exclusively on the sequence of inputs 
it has received so far ([causality property](https://en.wikipedia.org/wiki/Causal_system)). This means that it is possible to associate to a state transducer another function which takes a sequence of inputs into a 
 sequence of outputs, in a way that that function is pure. This is what enables testing.

## General concepts
There are a few things to be acquainted with :
- the state machine formalism
- its extension, including hierarchy (compound states), history states
- the library API

To familiarize the reader with these, we will be leveraging two examples. The first example is 
the aforementioned password selector. This pretty simple example will serve to showcase the API 
of the library, and standard state machine terminology. The second example modelizes the 
behaviour of a CD player. It is more complex, and will feature a hierarchical state machine. For 
this example, we will show a run of the machine, and by doing so, illustrate advanced concepts 
such as compound states, and history states. We will not indigate into the implementation however. For a very advanced example, I invite the reader to refer to [the wizard form demo](https://github.com/brucou/cycle-state-machine-demo).

We then present into more details the semantics of a state transducer and how it relates to its 
configuration. Finally we present our API whose documentation relies on all previously introduced
 concepts.

### Base example
We will be using as our base example the password selector we discussed previously. As a 
reminder, its behaviour was described by the following state machine : 

![password submit fsm](assets/password%20submit%20fsm.png)

To specify our machine, we need :
- a list of control states the machine can be in
- a list of events accepted by the machine
- the initial state of the machine (initial control state, initial extended state)
- to describe transitions from a control state to another 

The first three are clear from the graph. The last one can be deduced from the table (cf. above) 
describing the behaviour of the password selector. 

The fsm ends up being defined by:

```javascript
const initialExtendedState = {
  input: ""
};
const states = {
  [INIT]: "",
  [STRONG]: "",
  [WEAK]: "",
  [DONE]: ""
};
const initialControlState = INIT;
const events = [TYPED_CHAR, CLICKED_SUBMIT, START];
const transitions = [
  { from: INIT, event: START, to: WEAK, action: displayInitScreen },
  { from: WEAK, event: CLICKED_SUBMIT, to: WEAK, action: NO_ACTIONS },
  {
    from: WEAK,
    event: TYPED_CHAR,
    guards: [
      { predicate: isPasswordWeak, to: WEAK, action: displayInputInRed },
      { predicate: isPasswordStrong, to: STRONG, action: displayInputInGreen }
    ]
  },
  {
    from: STRONG,
    event: TYPED_CHAR,
    guards: [
      { predicate: isPasswordWeak, to: WEAK, action: displayInputInRed },
      { predicate: isPasswordStrong, to: STRONG, action: displayInputInGreen }
    ]
  },
  {
    from: STRONG,
    event: CLICKED_SUBMIT,
    to: DONE,
    action: displaySubmittedPassword
  }
];

```

where action factories mapped to a transition compute two things : 
- a list of updates to apply internally to the extended state
- an external output for the consumer of the state transducer 

For instance :

```javascript
function displayInitScreen() {
  return {
    updates: NO_STATE_UPDATE,
    outputs: [
      { command: RENDER, params: { screen: INIT_SCREEN, props: void 0 } }
    ]
  };
}

```

The full runnable code is [available here](https://codesandbox.io/s/73wy8jwk86).

### CD drawer example
This example is taken from Ian Horrock's seminal book on statecharts and is the specification of
 a CD player. The behaviour of the CD player is pretty straight forward and understandable 
 immediately from the visualization. From a didactical point of view, the example serves to feature 
 advanced characteristics of hierarchical state machines, including history states, composite states, 
 transient states, automatic transitions, and entry points. For a deeper understanding of how the
  transitions work in the case of a hierarchical machine, you can have a look at the 
  [terminology](https://github.com/brucou/state-transducer#terminology) and 
  [sample run](https://github.com/brucou/state-transducer#example-run) for the CD player machine.
 
![cd player state chart](http://i.imgur.com/ygsOVi9.jpg)

The salient facts are :
- `NO Cd loaded`, `CD_Paused` are control states which are composite states : they are themselves state machines comprised on control states.
- The control state `H` is a pseudo-control state called shallow history state
- All composite states feature an entry point and an automatic transition. For instance 
`CD_Paused` has the sixth control state as entry point, and the transition from `CD_Paused` into 
that control state is called an automatic transition. Entering the `CD_Paused` control state 
automatically triggers that transition.
- `Closing CD drawer` is a transient state. The machine will automatically transition away from 
it, picking a path according to the guards configured on the available exiting transitions

### Example run
To illustrate the previously described transducer semantics, let's run the CD player example.

| Control state      | Internal event | External event|
|--------------------|:-----------:|------------------|
| INIT_STATE         |     INIT_EVENT |                  |
| No Cd Loaded       |     INIT    |                  |
| CD Drawer Closed   |      --     |                  |
| CD Drawer Closed   |             | Eject            |
| CD Drawer Open     |             | Eject (put a CD) |
| Closing CD Drawer  |  eventless  |                  |
| CD Loaded          |     INIT    |                  |
| CD Loaded subgroup |     INIT    |                  |
| CD Stopped         |      --     |                  |
| CD stopped         |             | Play             |
| CD playing         |             | Forward down     |
| Stepping forwards  |             | Forward up       |
| **CD playing**     |      --     |                  |

Note :

- the state entry semantics -- entering `No Cd Loaded` leads to enter `CD Drawer Closed`
- the guard -- because we put a CD in the drawer, the machine transitions from `Closing CD Drawer` to `CD Loaded` 
- the eventless transition -- the latter is an eventless transition : the guards are 
automatically evaluated to select a transition to progress the state machine (by contract, there 
must be one)
- the hierarchy of states -- the `Forward down` event transitions the state machines to `Stepping
 forwards`, as it applies to all atomic states nested in the `CD Loaded subgroup` control state
- the history semantics -- releasing the forward key on the CD player returns to `CD Playing` the
 last atomic state for compound state `CD Loaded subgroup`.
 

## Transducer semantics
We give here a quick summary of the behaviour of the state transducer :

**Preconditions**

- the machine is configured with a set of control states, an initial extended state, 
transitions, guards, action factories, and user settings. 
- the machine configuration is valid (cf. contracts)
- Input events have the shape `{{[event_label]: event_data}}`

**Event processing**

- Calling the machine factory creates a machine according to specifications and triggers the 
reserved `INIT_EVENT` event which advances the state machine out of the reserved **internal** 
initial control state towards the relevant **user-configured** initial control state
  - the `INIT_EVENT` event carries the initial extended state as data
  - if there is no initial transition, it is required to pass an initial control state
  - if there is no initial control state, it is required to configure an initial transition
  - an initial transition is a transition from the reserved `INIT_STATE` initial control state, 
  triggered by the reserved initial event `INIT_EVENT`
- **Loop**
- Search for a feasible transition in the configured transitions
  - a feasible transition is a transition which is configured to deal with the received event, and 
  for which there is a fulfilled guard 
- If there is no feasible transition :
  - issue memorized output (`NO_OUTPUT` if none), extended state and control state do not change.
   **Break** away from the loop
- If there is a feasible transition, select the first transition according to what follows :
  - if there is an INIT transition, select that
  - if there is an eventless transition, select that
  - otherwise select the first transition whose guard is fulfilled (as ordered per array index)
- evaluate the selected transition
  - if the target control state is an history state, replace it by the control state it 
  references (i.e. the last seen nested state for that compound state)
  - **update the extended state** (with the updates produced by the action factory)
  - aggregate and memorize the outputs (produced by the action factory)
  - update the control state to the target control state
  - update the history for the control state (applies only if control state is compound state)
- iterate on **Loop**
- **_THE END_**

A few interesting points : 

- a machine always transitions towards an atomic state at the end of event processing
- on that path towards an atomic target state, all intermediary extended state updates are 
performed. Guards and action factories on that path are thus receiving a possibly evolving extended 
state. The computed outputs will be aggregated in an array of outputs.
 
The aforedescribed behaviour is loosely summarized here :

![event processing](assets/FSM%20event%20processing%20semantics.png)

**History states semantics**

An history state relates to the past configuration a compound state. There 
are two kinds of history states : shallow history states (H), and deep history states (H*). A 
picture being worth more than words, thereafter follows an illustration of both history states :

![deep and shallow history](test/assets/history%20transitions,%20INIT%20event%20CASCADING%20transitions.png)

Assuming the corresponding machine has had the following run `[INIT, EVENT1, EVENT3, EVENT5, 
EVENT4]`:
 
- the configurations for the `OUTER` control state will have been `[OUTER.A, INNER, INNER.S, INNER.T]`
 - the shallow history state for the `OUTER` control state will correspond to the `INNER` control
  state (the last direct substate of `OUTER`), leading to an automatic transition to INNER_S  
 - the deep history state for the `OUTER` control state will correspond to the `INNER.T` control
     state (the last substate of `OUTER` before exiting it)

In short the history state allows to short-circuit the default entry behaviour for a compound 
state, which is to follow the transition triggered by the INIT event. When transitioning to the 
history state, transition is towards the last seen state for the entered compound state.

### Contracts

#### Format
- state names must be unique and conform to the same nomenclature than javascript variable 
identifiers (cannot be empty strings, cannot start with a number, etc.)
- all transitions must be valid :
  - all states referenced in the `transitions` data structure must be defined in the `states` data 
  structure
  - the transition syntax must be followed (cf. types)
  - all transitions must define an action (even if that action does not modify the extended state
   or returns `NO_OUTPUT`)
- all action factories must fill in the `updates` and `outputs` property (no syntax sugar)
  - NO_OUTPUT must be used to indicate the absence of outputs

#### Initial event and initial state
By initial transition, we mean the transition with origin the machine's default initial state.

- An initial transition must be configured :
  - by way of a starting control state defined at configuration time
  - by way of a initial transition at configuration time
- ~~the init event has the initial extended state as event data~~
- the initial event can only be sent internally (external initial events will be ignored, and the 
machine will return `NO_OUTPUT`)
- the state machine starts in the reserved initial state
- there are no incoming transitions to the reserved initial state
- ~~The machine cannot stay blocked in the initial control state. This means that at least one 
transition must be configured and be executed between the initial control state and another state
.   This is turn means :~~
  - ~~at least one non-reserved control state must be configured~~
  - ~~at least one transition out of the initial control state must be configured~~
  - ~~of all guards for such transitions, if any, at least one must be fulfilled to enable a 
  transition away from the initial control state~~
- there is exactly one initial transition, with unambiguous target state, whose only effect is to 
determine the starting control state for the machine 
  - there is no guard on that transition
  - the action on that transition is the *identity* action 

#### Semantical contracts
- A transition evaluation must end
  - eventless transitions must progress the state machine
    - at least one guard must be fulfilled, otherwise we would remain forever in the same state
  - eventless self-transitions are forbidden (while theoretically possible, the feature is of 
  little practical value, though being a possible source of ambiguity or infinite loops)
  - ~~eventless self-transitions must modify the extended state~~
    - ~~lest we loop forever (a real blocking infinite loop)~~
    - ~~note that there is not really a strong rationale for eventless self-transition, I recommend 
      just staying away from it~~
- the machine is deterministic and unambiguous
  - **NOTE TO SELF**: absolutely enforce that contract
  - to a (from, event) couple, there can only correspond one row in the `transitions` array of the 
  state machine (but there can be several guards in that row)
      - (particular case) eventless transitions must not be contradicted by event-ful transitions
  - A -ev> B and A < OUTER_A with OUTER_A -ev>C !! : there are two valid transitions triggered by
     `ev`. Such transitions would unduely complicate the input testing generation, and decrease 
     the readability of the machine so we forbid such transitions[^x]
  - there cannot be two transitions with the same `(from, event, predicate)` - sameness defined for
     predicate by referential equality
- no transitions from the history state (history state is only a target state)
- A transition evaluation must end in an atomic state
  - Initial states must be defined for every compound state 
  - Every compound state must have eactly one INIT transition, i.e. a transition whose 
  triggering event is `INIT_EVENT`. That transition must have a target state which is a substate 
  of the compound state (no hierarchy crossing)
  - Compound states must not have eventless transitions defined on them (would introduce 
  ambiguity with the INIT transition)
  - (the previous conditions ensure that there is always a way down the hierarchy for compound 
  states, and that way is always taken when entering the compound state, and the descent 
  process always terminate)
- the machine does not perform any effects
  - guards, action factories are pure functions
    - as such exceptions while running those functions are fatal, and will not be caught
  - `updateState :: ExtendedState -> ExtendedStateUpdates -> ExtendedState` must be a pure function
   (this is important in particular for the tracing mechanism which triggers two execution of this 
   function with the same parameters)

[^x]: There are however semantics which allow such transitions, thus possibilitating event bubbling.

## `createStateMachine :: FSM_Def -> Settings -> FSM`
### Description
This FSM factory function takes the parameters defining the behaviour of the state transducer, 
and returns the created state transducer. The created state transducer is a regular function called 
with inputs which are passed to the internal state machine, and in return the computed outputs are
received. The syntax for an input is `{{[eventLabel] : eventData}}`, i.e. an input is an object with exactly one key, which is the event identifier, and the value matching the key is the event data.

The machine additionnally can carry over environment variables, which are accessible in guards, 
and action factories. This helps maintaining such functions pure and testable. Environment 
variables can also be used to parameterize the state machine's behaviour.

History states are generated by a factory returned by a helper `makeHistoryStates :: FSM_States -> 
HistoryStateFactory`. An history state is coupled to a compound state, and has a type (deep or 
shallow). Passing this information to the factory produdces the sought history state. 

The `settings.updateState` property is mandatory, and specify how to update a model from the `
.updates` produced by an action factory. We used successfully JSON patch operations for model 
updates, but you can choose to use the inmutable library of your choice or a simple reducer. The 
important point is that the extended state should not be modified in place, i.e. `updateState` is
 a pure function. 

### Contracts
- All [previously mentioned](https://github.com/brucou/state-transducer#contracts) contracts apply.
- The `settings.updateState` property is mandatory. 
- The `settings` property should not be modified after being passed as parameter (i.e. should be 
a constant): it is not cloned and is passed to all relevant functions (guards, etc.)
- The [key types](https://github.com/brucou/state-transducer/blob/master/src/types.js) contracts 
are summarized here :

```javascript
/**
 * @typedef {Object} FSM_Def
 * @property {FSM_States} states Object whose every key is a control state admitted by the
 * specified state machine. The value associated to that key is unused in the present version of the library. The
 * hierarchy of the states correspond to property nesting in the `states` object
 * @property {Array<EventLabel>} events A list of event monikers the machine is configured to react to
 * @property {Array<Transition>} transitions An array of transitions the machine is allowed to take
 * @property {*} initialExtendedState The initial value for the machine's extended state
 */
/**
 * @typedef {Object.<ControlState, *>} FSM_States
 */
/**
 * @typedef {InconditionalTransition | ConditionalTransition} Transition
 */
/**
 * @typedef {{from: ControlState, to: ControlState|HistoryState, event: EventLabel, action: ActionFactory}} InconditionalTransition
 *   Inconditional_Transition encodes transition with no guards attached. Every time the specified event occurs, and
 *   the machine is in the specified state, it will transition to the target control state, and invoke the action
 *   returned by the action factory
 */
/**
 * @typedef {{from: ControlState, event: EventLabel, guards: Array<Condition>}} ConditionalTransition Transition for the
 * specified state is contingent to some guards being passed. Those guards are defined as an array.
 */
/**
 * @typedef {{predicate: FSM_Predicate, to: ControlState|HistoryState, action: ActionFactory}} Condition On satisfying the
 * specified predicate, the received event data will trigger the transition to the specified target control state
 * and invoke the action created by the specified action factory, leading to an update of the internal state of the
 * extended state machine and possibly an output to the state machine client.
 */
/**
 * @typedef {function(ExtendedState, EventData, FSM_Settings) : Actions} ActionFactory
 */
/**
 * @typedef {{updates: ExtendedStateUpdate, outputs: Array<MachineOutput> | NO_OUTPUT}} Actions The actions
 * to be performed by the state machine in response to a transition. `updates` represents the state update for
 * the variables of the extended state machine. `output` represents the output of the state machine passed to the
 * API caller.
 */
/** @typedef {function (ExtendedState, EventData) : Boolean} FSM_Predicate */
/** @typedef {{updateState :: Function(ExtendedState, ExtendedStateUpdate) : ExtendedState, ...}} FSM_Settings */
/**
 * @typedef {Object.<EventLabel, EventData>} LabelledEvent extended state for a given state machine
 */
/**
 * @typedef {function(historyType: HistoryType, controlState: ControlState): HistoryState} HistoryStateFactory
 */
/**
 * @typedef {{type:{}, [HistoryType]: ControlState}} HistoryState
 */
/**
 * @typedef {Object.<HistoryType, HistoryDict>} History history object containing deeep and shallow history states
 * for all relevant control states
 */
/**
 * @typedef {Object.<ControlState, ControlState>} HistoryDict Maps a compound control state to its history state
 */
/**
 * @typedef {DEEP | SHALLOW} HistoryType
 */
/** @typedef {String} ControlState Name of the control state */
/** @typedef {String} EventLabel */
/**
 * @typedef {*} EventData
 */
/**
 * @typedef {*} ExtendedState extended state for a given state machine
 */
/**
 * @typedef {*} ExtendedStateUpdate
 */
/** @typedef {* | NO_OUTPUT} MachineOutput well it is preferrable that that be an object instead of a primitive */
```

### Implementation example
We are going to show the definition for the following hierrchical state machine :

![state machine under test](test/assets/history%20transitions,%20INIT%20event%20CASCADING%20transitions.png)

The definition is as follows :

```javascript
  const states = { [OUTER]: { [INNER]: { [INNER_S]: '', [INNER_T]: '' }, [OUTER_A]: '', [OUTER_B]: '' }, [Z]: '' };
  const hs = makeHistoryStates(states);
  const fsmDef = {
    states,
    events: [EVENT1, EVENT2, EVENT3, EVENT4, EVENT5],
    initialExtendedState: { history: DEEP, counter: 0 },
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: OUTER, action: ACTION_IDENTITY },
      { from: OUTER, event: INIT_EVENT, to: OUTER_A, action: ACTION_IDENTITY },
      { from: OUTER_A, event: EVENT1, to: INNER, action: ACTION_IDENTITY },
      { from: INNER, event: INIT_EVENT, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER_S, event: EVENT3, to: INNER_T, action: ACTION_IDENTITY },
      { from: INNER_T, event: EVENT3, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER, event: EVENT2, to: OUTER_B, action: ACTION_IDENTITY },
      { from: OUTER, event: EVENT5, to: Z, action: ACTION_IDENTITY },
      {
        from: Z, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs.deep(OUTER),
            action: incCounter
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs.shallow(OUTER),
            action: incCounter
          }
        ]
      },
    ],
  };
```

Note in particular :
- the nesting of states in `states`
- the use of `ACTION_IDENTITY` when there is no action to be applied
  - that action does not modify the extended state of the machine, and returns `NO_OUTPUT`
- how history states are included in the machine definition

There are plenty of additional examples in the [test directory](https://github.com/brucou/state-transducer/blob/master/test/hierarchy.specs.js).

## makeWebComponentFromFsm :: TODO -> ()
**TODO for v1.0**

Register the machine as a web component.

## `traceFSM :: Env -> FSM_Def -> FSM_Def`
### Description
This function converts a state machine `A` into a traced state machine `T(A)`. The traced state 
machine, on receiving an input `I` outputs the following information :

- `outputs` : the outputs `A(I)` 
- `updates` : the update of the extended state of `A` to be performed as a consequence of receiving the input `I` 
- `extendedState` : the extended state of `A` **prior** to receiving the input `I`
- `newExtendedState` : the extended state of `A` **after** receiving the input `I` and computing 
the outputs
- `controlState` : the control state in which the machine is when receiving the input `I`
- `event::{eventLabel, eventData}` : the event label and event data corresponding to `I` 
- `settings` : settings passed at construction time to `A`
- `targetControlState` : the target control state the machine has transitioned to as a consequence of receiving the input `I`
- `predicate` : the predicate (guard) corresponding to the transition that was taken to 
`targetControlState`, as a consequence of receiving the input `I`
- `actionFactory` : the action factory which was executed as a consequence of receiving the 
input `I`
- `guardIndex` : the index for the guard in the `.guards` array of a transition away from a 
control state, triggered by an event
- `transitionIndex` : the index for the transition in the `.transitions` array which contain the 
specifications for the machine's transition

Note that the trace functionality is obtained by wrapping over the action factories in `A`. As 
such, all action factories will see their output wrapped. This means :

- transitions which do not lead to the execution of action factories are not traced
- when the machine cannot find any transition for an event, hence any action to execute, 
the traced machine will simply return `null`.


Note also that `env` is not used for now, and could be used to parameterize the tracing.

### Contracts
Types contracts, nothing special.

### Implementation example
Cf. tests

## `generateTestSequences :: FSM_Def -> Generators -> GenSettings -> Array<TestCase>`
### Description
The `generateTestSequences` method produce test cases from a state machine definition, and input 
generators associated to each transition defined in the machine. The test generation strategy is 
specified in `genSettings.strategy` (two common strategies are already defined in `graph-adt` 
library and can be reused). Additionally the `genSettings` parameter can contain any relevant 
parameters to be passed to the state machine when it is created. 

Input generators (`Generators`) are coupled to a given state machine for which they generate an 
input sequence. The structure of `Generators` hence replicates the structure of the transitions of
 the state machine under test. Typically we recommend copy pasting transitions from `FSM_Def`,  
 and add a `gen` property for each transition definition (you can keep or remove any of the 
 other properties - they are ignored). That `gen` property is a 
 function, which must generate event data for the event defined in 
 the coupled transition, or signal impossibility of such generation. If the generator does
  generate event data, then we have a candidate input for inclusion in the test input sequence.

The generators receive as input the extended state for the state machine, and the current value 
of the input generation state. The input generation state is empty when the input generation 
starts, and only generators have the possibility to update it. The generator thus computes and 
returns three things :
- whether it can generate an input which makes the machine take the coupled transition
- the input that makes the machine take the coupled transition if any
- the updated input generation state

The input generation state is for instance used in the [movie search app](https://github.com/brucou/movie-search-app/blob/with-state-library/tests/test-generation.specs.js) demo to ensure that 
different movie searches are generated every time the user returns to the querying control state.

The generation strategy is determined by two predicates,  `isGoalReached` and `isTraversableEdge`, 
with the same signature :
- `isGoalReached` answers the question of whether an input sequence is 
as good as finalized, and should be wrapped as a test case; or if alternatively the search should 
continue, possibly increasing the input sequence or possibly failing to generate an input sequence. 
Commonly, this function will test if a target control state is reached, as we often seek to 
generate input sequences driving the machine to a given state. 
- `isTraversableEdge` answers the question of whether a transition (edge of the graph 
corresponding to the machine) should be taken, adding the generated input to the current input 
sequence. `isTraversableEdge` is commonly used to fulfill a coverage criteria, for instance 
*All-transition* (No test case can lead to a transition to be taken twice). As a matter of fact,
 the input generation is an exhaustive enumeration of edge paths in the state machine graph, which `isTraversableEdge` filters down through its criteria.

There are two premade strategies which you can use, instead of configuring the generation 
strategy by yourself :
- `ALL_n_TRANSITIONS({ targetVertex: ..., maxNumberOfTraversals: ... })` 
  - this strategy constructs the input sequences for which the machine ends in the target control
   state `targetVertex`, and no transition taken as a result of applying the input sequence to 
   the machine is taken more than the `maxNumberOfTraversals`
- `ALL_TRANSITIONS({ targetVertex: ... })`
  - this strategy is a particular case of the former strategy with `maxNumberOfTraversals` set to 1
  - this strategy visits all the configured transitions of the state machine

Any generated test case fulfills the goal specified by `isGoalReached`, and fulfills the conditions
 imposed by `isTraversableEdge`. The test case gathers the generated input sequence, together 
 with the outputs and control state sequences corresponding to running the generated input sequence 
 through the state machine. 

**Important caveats** : 
- The machine configuration generally specifies only those events which must be 
reacted to. However it is implicitly part of the machine's specification that the events which are 
not configured for the current control state to cause the machine to output `NO_OUTPUT`. A 
**complete** specification of the machine would involve for every control state, an 
explicit transition defining its behaviour for every event handled by the machine. For obvious 
reasons of economy, we hardly ever write explicitly complete state machines 
- For that reason, keep in mind that `generateTestSequences` generates what we would call valid or 
interesting test sequences. Invalid or impossible input sequences are not generated by design. It is thus not
 possible to use directly the test generator output to test against the behaviour of the machine 
 when facing an incorrect input sequence

### Semantics
- the state machine is turned into a graph
  - the machine is flattened : all outgoing transitions from a compound state are replaced by 
  the equivalent set of transitions whose origin state is an atomic substate... well, except for 
  the outgoing INIT transition, which remains identical
    - `[A < B < C, A < B < D]`, and `A -ev-> B`, is replaced by `C -ev-> B, D -ev-> B`     
  - a transition to a history state will be translated in a transition to any possible history 
  target, with an attached guard which only allows the transition if the history state is indeed 
  the attached control state
- the graph is searched starting with the initial state with the view to generate all possible 
paths of the state machine, starting from the initial state
  - if the graph is A -> B, B-> C, B -> D, then the graph search generates `[A,B,C]` and `[A,B,D]`
- At any point, the state of the search is the array of test cases already generated, and the 
test case in process, starting from an initial state with empty test cases
- a test case is generated iteratively as follows :
  - the machine starts in the initial state.
  - the test case is initially empty
  - the graph search produces a candidate edge (transition)
  - if the edge is not traversable (`isTraversableEdge`) then the search branch is abandoned, no 
  input case is generated, the search backtracks and continues with investigating another path 
  sequence
  - otherwise, the input generator generates an input exercising that transition or signals there is
   no such input
    - if no satisfying input can be generated, the search branch is abandoned, no input case is 
    generated, the search backtracks and continues with investigating another path sequence
      - for instance, for the previous graph, if `[A,B,C]` fails to generate a case, then `[A,B,D]` 
      is tried next
    - if an input trigerring the transition is generated, it is added to the test case in 
    progress, together with the corresponding outputs of the machine, the resulting control 
    state and the updated input generation state
  - the candidate transition may result in a cascade of transitions, due to special 
  transitions (eventless, automatic transitions (for instance entering a compound state, 
  transition involving history states). The  test case is adjusted accordingly.
  - if the goal is reached (`isGoalReached`) with the updated test case, then that test case is 
  considered finalized and added to the current list of generated test case. the search 
  backtracks and continues with investigating another path sequence
- in summary, there are two reductions processes and two accumulators involved:
  - the `PathTraversalState`, which gathers the path sequence and associated data (input 
  sequence, output sequence, control state sequence, and input generation state)
  - the `GraphTraversalState`, which gathers the generated test cases
- when the search finished, the array of generated test cases is returned

### Contracts
Type contracts apply.

```javascript
/**
 * @typedef {Array<GenTransitionFromState>} Generators An array of transitions associated to an input generator for
 * the sut
 */
/**
 * @typedef {{from: ControlState, event: Event, guards: Array<GenSpecs>}} GenTransitionFromState Transition for the
 * specified state is contingent to some guards being passed. Those guards are defined as an array. The `from` and
 * `event` properties are not used by the program, we kept them here to assist writing the input generator by having
 * the transition it refers to at hand.
 */
/**
 * @typedef {{predicate: Predicate, gen: InputGenerator, to: ControlState}} GenSpecs Specifies a generator `gen`
 * which will be responsible for computing event data for events which pass the predicate, triggering a transition to
 * `to` control state. The `predicate` and `to` properties are not used by the program, we kept them here to
 * assist writing the input generator by having the transition it refers to at hand.
 */
/**
 * @typedef {function (ExtendedState) : {input: EventData, hasGeneratedInput: Boolean, generatorState:*}} InputGenerator
 * generator which knows how to generate event data for an event to trigger the related transition, taking into
 * account the extended state of the machine under test, and the state of the input generation. In the event, it is not
 * possible to generate the targeted transition of the state machine, the generator sets the returned property
 * `hasGeneratedInput` to `false`. The generator may also update the state of the input generation.
 */
/**
 * @typedef {{inputSequence: InputSequence, outputSequence:OutputSequence, controlStateSequence:ControlStateSequence}} TestCase
 */
/**
 * @typedef {Array<LabelledEvent>} InputSequence
 */
/**
 * @typedef {Array<MachineOutput>} OutputSequence
 */
/**
 * @typedef {Array<ControlState>} ControlStateSequence
 */
/**
 * @typedef {function (Edge, Graph, PathTraversalState, GraphTraversalState) : Boolean} SearchPredicate Computes a
 * boolean in function of the current visited edge, the current search path, and the previously accumulated results.
 * In addition the graph ADT is available for querying graph entities (vertices, edges, etc).
 */
/**
 * @typedef {{ isGoalReached : SearchPredicate, isTraversableEdge : SearchPredicate}} SearchStrategy
 */
/**
 * @typedef {{strategy : SearchStrategy, updateState, ...}} GenSettings Must contain settings for the associated
 * state machine under test (the `...` part), and the search strategy for the associated graph. Most often, it will
 * be enough to reuse premade search strategy : ALL_TRANSITIONS,  ALL_n_TRANSITIONS, etc.
 */

```

### Implementation example
We are going to reuse here a former example :

![state machine under test](test/assets/history%20transitions,%20INIT%20event%20CASCADING%20transitions.png)

We remind here the machine definition: 

```javascript
  const states = { [OUTER]: { [INNER]: { [INNER_S]: '', [INNER_T]: '' }, [OUTER_A]: '', [OUTER_B]: '' }, [Z]: '' };
  const hs = makeHistoryStates(states);
  const fsmDef = {
    states,
    events: [EVENT1, EVENT2, EVENT3, EVENT4, EVENT5],
    initialExtendedState: { history: DEEP, counter: 0 },
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: OUTER, action: ACTION_IDENTITY },
      { from: OUTER, event: INIT_EVENT, to: OUTER_A, action: ACTION_IDENTITY },
      { from: OUTER_A, event: EVENT1, to: INNER, action: ACTION_IDENTITY },
      { from: INNER, event: INIT_EVENT, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER_S, event: EVENT3, to: INNER_T, action: ACTION_IDENTITY },
      { from: INNER_T, event: EVENT3, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER, event: EVENT2, to: OUTER_B, action: ACTION_IDENTITY },
      { from: OUTER, event: EVENT5, to: Z, action: ACTION_IDENTITY },
      {
        from: Z, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs.deep(OUTER),
            action: incCounter
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs.shallow(OUTER),
            action: incCounter
          }
        ]
      },
    ],
  };
```

We are seeking to generate test cases which end with the machine in the state `OUTER_B`.

We are configuring our input generators by copy pasting the state machine under test and adding 
the generators definition for each control state ; 

```javascript
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, to: OUTER,
        gen: function genINITtoOUTER(extS) {return { input: extS, hasGeneratedInput: true }}
      },
      { from: OUTER, event: INIT_EVENT, to: OUTER_A },
      {
        from: OUTER_A, event: EVENT1, to: INNER,
        gen: function genOUTER_AtoINNER(extS) {return { input: null, hasGeneratedInput: true }}
      },
      { from: INNER, event: INIT_EVENT, to: INNER_S },
      {
        from: INNER_S, event: EVENT3, to: INNER_T,
        gen: function genINNER_StoINNER_T(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: INNER_T, event: EVENT3, to: INNER_S,
        gen: function genINNER_TtoINNER_S(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: INNER, event: EVENT2, to: OUTER_B,
        gen: function genINNERtoOUTER_B(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: OUTER, event: EVENT5, to: Z,
        gen: function genOUTERtoZ(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: Z, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs.deep(OUTER),
            gen: function genZtoOUTER_DEEP_H(extS) {return { input: DEEP, hasGeneratedInput: extS.history === DEEP }},
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs.shallow(OUTER),
            gen: function genZtoOUTER_SHALLOW_H(extS) {
              return {
                input: SHALLOW,
                hasGeneratedInput: extS.history !== DEEP
              }
            },
          }
        ]
      },
    ],
  };
```

Note that :
- some events carry no event data (`EVENT_1` for instance). The generator hence sets 
`null` as generated event data.
- some events have no guards. The corresponding generators hence always have `hasGeneratedInput =
 true`, as those events are always triggering a transition when they occur
- some events have guards. The corresponding generator will set `hasGeneratedInput` to false when
 the guard cannot be satisfied. A guard is a function of the extended state `extS` and the event 
 data. The generator is passed the event data. According to the guard at end, the generator must 
 resolve the equation `find extS so that for all eventData, guard(extS, eventData) = false`. For 
 those `extS`, the `hasGeneratedInput` will be set to false : no matter the event, the guard can 
 never be satisfied. For the rest of the cases, the generator will pick an `EventData` which 
 satisfies the guard, if any.

We then define our extended state update method, our search strategy (*All-transitions* coverage) : 

```javascript
  const generators = genFsmDef.transitions;
  const settings = { updateState: applyJSONpatch, strategy: ALL_TRANSITIONS({ targetVertex: 
  OUTER_B }) };
  const results = generateTestSequences(fsmDef, generators, settings);
```

We then get the results back :

**Test case inputs**
```javascript
[
    [
      { "init": { "counter": 0, "history": "deep" } },
      { "event1": null }, { "event3": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "init": { "counter": 0, "history": "deep" } },
      { "event1": null }, { "event3": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }
    ],
    [
      { "init": { "counter": 0, "history": "deep" } },
      { "event1": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "init": { "counter": 0, "history": "deep" } },
      { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }
    ],
    [
      { "init": { "counter": 0, "history": "deep" } },
      { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }
    ],
    [
      { "init": { "counter": 0, "history": "deep" } },
      { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event1": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event3": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event3": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event3": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{
      "init": { "counter": 0, "history": "deep" }
    }, { "event5": null }, { "event4": "deep" }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }]
]

```

**Test case outputs**

```javascript

[
    [null, null, null, null, null],
    [null, null, null, null, null, 0, null],
    [null, null, null, null],
    [null, null, null, null, 0, null, null],
    [null, null, null, null, 0, null, null, 1, null],
    [null, null, null, null, 0, null],
    [null, null, null],
    [null, null, null, 0, null, null, null],
    [null, null, null, 0, null, null],
    [null, null, null, 0, null, null, 1, null, null],
    [null, null, null, 0, null, null, 1, null],
    [null, null, null, 0, null],
    [null, null, 0, null, null, null, null],
    [null, null, 0, null, null, null, null, 1, null],
    [null, null, 0, null, null, null],
    [null, null, 0, null, null, null, 1, null, null],
    [null, null, 0, null, null, null, 1, null, null, 2, null],
    [null, null, 0, null, null, null, 1, null],
    [null, null, 0, null, null],
    [null, null, 0, null, null, 1, null, null, null],
    [null, null, 0, null, null, 1, null, null],
    [null, null, 0, null, null, 1, null, null, 2, null, null],
    [null, null, 0, null, null, 1, null, null, 2, null],
    [null, null, 0, null, null, 1, null]
  ]
```

Note that :
- to every input passed to the machine, there is an array of data produced as output. That array 
is concatenated to constitute the output sequence.
- Here because that array of data only has one item, we can easily relate input from a given input 
sequence to the matching output of the corresponding output sequence : they have the same index! 
That would however not be the case in general.

The corresponding sequence of control states is as follows :

```javascript
[
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "z", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "z", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "z", "inner_t", "inner_s", "z", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "z", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "inner_s", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "inner_s", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "inner_s", "inner_t", "z", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "inner_s", "inner_t", "z", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "z", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "z", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "z", "inner_t", "inner_s", "z", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "z", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "inner_s", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "inner_s", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "inner_s", "inner_t", "z", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "inner_s", "inner_t", "z", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "inner_s", "outer_b"]
]
```

Note that:
- we have exercised all possible transitions in our state machine. 
- The somewhat tricky part here is to understand that, for instance, the transition `INNER 
-EVENT2-> OUTER.B` in fact is a factorisation of 2 transitions : `INNER.S -EVENT2-> OUTER.B`, 
`INNER.T-EVENT2-> OUTER.B`!
- An even trickier part is to realize that transitions to history states are 
factorizations for transitions to any of the relevant substates of the nesting compound state. Hence
 `z -EVENT4-> H` is factorization for `z -EVENT4-> OUTER.A`, `z -EVENT4-> OUTER.B`, `z -EVENT4-> 
 INNER`, and `z -EVENT4-> H*` is factorization for `z -EVENT4-> OUTER.A`, `z -EVENT4-> OUTER.B`, 
 `z -EVENT4-> INNER.S` , `z -EVENT4-> INNER.T`!
- we had 5 non-trivial control states, 8 non-trivial transitions, and we ended up with 24 
input sequences to test all paths on which no transitions is repeated (loop-free paths)! 

There are ample tests which can serve as example in the [test directory](https://github.com/brucou/state-transducer/blob/master/test/test_generation.specs.js).

# Possible API extensions
Because of the API design choices, it is possible to realize the possible extensions without 
modifying the state chart library (open/closed principle):

- entry and exit actions
  - decorating action factories (cf. the [multi-step workflow demo repo](https://github.com/brucou/cycle-state-machine-demo))
- logging/tracing/monitoring
  - achieved through decorating both guards and action factories
- contract checking (preconditions, postconditions and probably invariants - to be investigated) 
for both states and transitions
  - can be done by inserting in first position extra guards which either fail or throw, and 
  decorating exising guards
- starting with a specific control state and extended state
  - can be achieved by modifying the `INIT` transition (by contract there is exactly one such 
  transition) and the `initial_extended_state`; and leaving everything else intact

Note that these extensions more often than not would perform effects (logs, ...), meaning that the 
order of application becomes significant in general. The practical consequences of this are to be 
investigated further at a later point. 

Equipped with a history of inputs and the corresponding history of outputs, it is also possible to
 do property-based testing (for instance checking that a pattern in a sequence of outputs occurs only 
when a pattern occurs in the matching sequence of inputs).

These extensions are useful to check/test the **design** of the automata, i.e. checking that the 
automata which acts as modelization of requirements indeed satisfies the requirements. When 
sufficient confidence is acquired, those extensions can be safely removed.

# Visualization tools
We have included two helpers for visualization of the state transducer :

- conversion to plantUML : `toPlantUml :: FSM_Def -> PlantUml`.
  - the resulting chain of characters can be pasted in [plantText](`https://www.planttext.com/`) 
  or [plantUML previewer](http://sujoyu.github.io/plantuml-previewer/) to get an automated graph 
  representation. Both will produce the exact same visual representation.
- conversion to [online visualizer](https://github.com/brucou/state-transducer-visualizer) 
format (dagre layout engine) : for instructions, cf. github directory : `toDagreVisualizerFormat 
:: FSM_Def -> JSON`

![visualization example](https://github.com/brucou/state-transducer-visualizer/raw/master/assets/cd-player-automatic-dagre-visualization.png)

Automated visualization works well with simple graphs, but seems to encounter trouble to generate
 optimally satisfying complex graphs. The Dagre layout seems to be a least worse option. We 
 believe the best option for visualization is to use professional specialized tooling such as 
 `yed`. In a future version, we will provide a conversion to `yed` graph format to facilitate 
 such workflow. The [`yed`](https://www.yworks.com/products/yed) orthogonal and flowchart layout 
 seem to give pretty good results.

# References
- [the ultimate guide to FSM in games](https://www.researchgate.net/publication/284383920_The_Ultimate_Guide_to_FSMs_in_Games)
- [artificial intelligence - state machines](http://aiwisdom.com/ai_fsm.html)
- [A method for testing and validating executable statechart models](https://link.springer.com/article/10.1007/s10270-018-0676-3)
- Credit to [Pankaj Parashar](https://css-tricks.com/password-strength-meter/) for the password 
selector

# Roadmap
## Roadmap v1.0
- [x] stabilise core API
  - state machine as an effectless, impure function with causality properties
  - expose only the factory, keep internal state fully encapsulated
- [x] test [integration with React](https://github.com/brucou/react-state-driven)
- [x] support [model-based testing, and test input generation](https://pdfs.semanticscholar.org/f8e6/b3019c0d5422f35d2d98c242f149184992a3.pdf)
  - [x] *all-transitions* coverage test case generator
- [x] add tracing support
  - obtained by decorating the machine definition
- [x] add entry actions

## Roadmap v1.1
- [ ] support for visualization in third-party tools
- [ ] document entry actions
- [ ] showcase property-based testing
- [ ] add cloning API
- [ ] add reset API

## Roadmap v1.2
- [ ] support for live, interactive debugging

## Roadmap v1.3
- [ ] add and document exit actions
- [ ] turn the test generation into an iterator(ES6 generator) : this allows it to be composed with 
transducers and manipulate the test cases one by one as soon as they are produced. Will be useful
 for both example-based and property-based testing. When the generators runs through thousands of
  test cases, we often have to wait a long time before seeing any result, which is pretty 
  damageable when a failure is located toward the ends of the generated input sequences.
- [ ] add other searches that DFS, BFS (add probability to transitions, exclude some transitions,
 etc.). HINT : `store.pickOne` can be used to select the next transition
   - pick a random transition
   - pick next transition according to ranking (probability-based, prefix-based or else) 

# Who else uses state machines
The use of state machines is not unusual for safety-critical software for embedded systems. 
Nearly all safety-critical code on the Airbus A380 is implemented with a [suite of tools](https://www.ansys.com/products/embedded-software/ansys-scade-suite/scade-suite-capabilities#cap1) which 
produces state machines both as [specification](https://www.youtube.com/watch?list=PL0lZXwHtV6Ok5s-iSkBjHirM1fu53_Phv&v=EHP_spl5xU0) and [implementation](https://www.youtube.com/watch?v=523bJ1vZZmw&index=5&list=PL0lZXwHtV6Ok5s-iSkBjHirM1fu53_Phv) 
target. The driver here is two-fold. On the one hand is productivity : writing highly reliable code
 by hand can be done but it is painstakingly slow, while state machines allow to **generate the code** 
automatically. On the other hand is reliability. Quoting Gerard Berry, founder of Esterel 
technologies, [<< low-level programming techniques will not remain acceptable for large 
safety-critical programs, since they make behavior understanding and analysis almost 
impracticable >>](https://ptolemy.berkeley.edu/projects/chess/design/2010/discussions/Pdf/synclang.pdf), in a harsh regulatory context 
which may require that every single system requirement 
be traced to the code that implements it (!). Requirements modeled by state-machines are amenable
 to formal verification and validation. 

State machines have also been used extensively in [games of reasonable complexity](http://howtomakeanrpg.com/a/state-machines.html), and [tutorials](https://www.gamedev.net/articles/programming/general-and-gameplay-programming/state-machines-in-games-r2982/) abound
 on the subject. The driving factors are again two. First, the basic problem for AI to solve 
 here is : given the state of the world, what should I do? Because game character behavior can be
  modeled (in most cases) as a sequence of different character "mental states", where change in 
  state is driven by the actions of the player or other characters, or possibly some features 
  of the game world, game programmers often find that state machines are a natural choice for 
  defining character AI.  Second, it is a very accessible and affordable tool vs. alternatives. The 
  "decision-action" model is [straightforward enough to appeal to the nonprogrammers](https://www.researchgate.net/publication/284383920_The_Ultimate_Guide_to_FSMs_in_Games) on the game 
  development team (such as level designers), yet impressively powerful. FSMs also lend 
  themselves to being quickly sketched out during design and prototyping, and even better, they 
  can be easily and efficiently implemented. 

More prosaically, did you know that ES6 generators compile down to ES5 state machines where no 
native option is available? Facebook's [`regenerator`](https://github.com/facebook/regenerator) 
is a good example of such.

So state machines are nothing like a new, experimental tool, but rather one with a fairly extended 
and proven track in both industrial and consumer applications. 

# Annex
## So what is an Extended Hierarchical State Transducer ? 
Not like it matters so much but anyways. Feel free to skip that section if you have little 
interest in computer science.

Alright, let's build the concept progressively.

An [automaton](https://en.wikipedia.org/wiki/Automata_theory) is a construct made of states 
designed to determine if a sequence of inputs should be accepted or rejected. It looks a lot like a 
basic board game where each space on the board represents a state. Each state has information about what to do when an input is received by the machine (again, rather like what to do when you land on the Jail spot in a popular board game). As the machine receives a new input, it looks at the state and picks a new spot based on the information on what to do when it receives that input at that state. When there are no more inputs, the automaton stops and the space it is on when it completes determines whether the automaton accepts or rejects that particular set of inputs.

State machines and automata are essentially interchangeable terms. Automata is the favored term 
when connoting automata theory, while state machines is more often used in the context of the 
actual or practical usage of automata.

An extended state machine is a state machine endowed with a set of variables, predicates (guards)
and instructions governing the update of the mentioned set of variables. To any extended state 
machines it corresponds a standard state machine (albeit often one with a far greater number of 
states) with the same semantics.

A hierarchical state machine is a state machine whose states can be themselves state machines. 
Thus instead of having a set of states as in standard state machines, we have a hierarchy (tree) of 
states describing the system under study.

A [state transducer](https://en.wikipedia.org/wiki/Finite-state_transducer) is a state 
machine, which in addition to accepting inputs, and modifying its state accordingly, may also 
generate outputs.

We propose here a library dealing with extended hierarchical state transducers, i.e. a state machine
whose states can be other state machines (hierarchical part), which (may) associate an output to an 
input (transducer part), and whose input/output relation follows a logic guided by 
predefined control states (state machine part), and an encapsulated memory which can be 
modified through actions guarded by predicates (extended part).

Note that if we add concurrency and messaging to extended hierarchical state transducers, we get
 a statechart. We made the design decision to remain at the present level, and not to incorporate 
 any concurrency mechanism.[^2]

[^2]: Our rationale is as follows :  
 - statecharts include activities and actions which may produce effects, and concurrency. We are 
 seeking an purely computational approach (i.e effect-less) to facilitate **composition, reuse and 
  testing**. 
 - In the absence of concurrency (i.e. absence of parallel regions), a statechart can be turned 
 into a hierarchical state transducer. That is often enough! 
 - there is no difference in terms of 
 expressive power between statecharts and hierarchical transducers[^4], just as there is no 
 difference in expressive power between extended state machines and regular state machines. The 
 difference lies in naturalness and convenience : a 5-state extended state machine is 
 easier to read and maintain than the equivalent 50-state regular state machine. 
 - we argue that convenience here is on the side of being able to freely plug in any [concurrent 
 or communication model](http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.92.6145&rep=rep1&type=pdf) fitting the problem space. In highly concurrent systems, programmers may have it hard to elaborate a mental model of the statecharts solely from the visualization of 
 concurrent statecharts.
 - some [statecharts practitioners](http://sismic.readthedocs.io/en/master/communication.html#) 
 favor having separate state charts communicating[^5] in an ad-hoc way rather than an integrated 
 statechart model where concurrent state charts are gathered in nested states of a single 
 statechart. We agree.
 
[^3]: As a matter of fact, more than 20 different semantics have been proposed to define 
precisely the concurrency model for statecharts, e.g Rhapsody, Statemate, VisualMate, StateFlow, 
UML, etc. do not share a single concurrency model.
[^4]: David Harel, Statecharts.History.CACM : Speaking in the strict mathematical sense of power 
of expression, hierarchy and orthogonality are but helpful abbreviations and can be eliminated
[^5]: David Harel, Statecharts.History.CACM : <<I definitely do not recommend having a single 
statechart for an entire system. (...) concurrency occurs on a higher level.)>>

## Terminology
In this section, we seek to define quickly the meaning of the key terms which will be commonly 
used when referring to state machines.

<dl>
  <dt>control state</dt>
  <dd>Control states, in the context of an extended state machine is a piece of the internal state
   of the state machine, which serves to determine the transitions to trigger in response to 
   events. Transitions only occur between control states. Cf. base example illustration. </dd>
  <dt>extended state</dt>
  <dd>We refer by extended state the piece of internal state of the state machine which can be 
  modified on transitioning to another state. That piece of internal state **must** be 
  initialized upon creating the state machine. In this context, the extended state will simply 
  take the form of a regular object. The shape of the extended state is largely 
  application-specific. In the context of our multi-steps workflow, extended state could for 
  instance be the current application data, which varies in function of the state of the 
  application.</dd>
  <dt>input</dt>
  <dd>In the context of our library, we will use interchangeable input for events. An automata 
  receives inputs and generated outputs. However, as a key intended use case for this
   library is user interface implementation, inputs will often correspond to events generated by a 
   user. We thus conflate both terms in the context of this documentation.
  </dd>
  <dt>external event</dt>
  <dd>External events are events which are external and uncoupled to the state machine at hand. 
  Such events could be, in the context of an user interface, a user click on a button.
  </dd>
  <dt>internal event</dt>
  <dd>Internal events are events coupled to a specific state machine. Depending on the semantics 
  of a particular state machine, internal events may be generated to realize those semantics. In 
  the context of our library, we only generate internal events to trigger automatic transitions. 
  </dd>
  <dt>initial event</dt>
  <dd>In the context of our library, the initial event (<b>INIT_EVENT</b>) is fired automatically
   upon starting a state machine. The initial event 
  can be used to configure the initial machine transition, out from the initial control state. 
  However it is often simpler to just configure an initial control state for the machine.
  </dd>
  <dt>automatic event</dt>
  <dd>This is an internally triggered event which serves to triggers transitions from control 
  states for which no triggering events are configured. Such transitions are called automatic 
  transitions. Not firing an automatic event would mean that the state machine would be forever  
  stuck in the current control state.
  </dd>
  <dt>transition</dt>
  <dd>Transitions are changes in tne control state of the state machine under study. Transitions 
  can be configured to be taken only when predefined conditions are fulfilled (guards). 
  Transitions can be triggered by an event, or be automatic when no triggering event is specified.
  </dd>
  <dt>automatic transition</dt>
  <dd>Transitions between control states can be automatically evaluated if there are no 
  triggering events configured. The term is a bit confusing however, as it is possible in theory 
  that no transition is actually executed, if none of the configured guard is fulfilled. We 
  forbid this case by contract, as failing to satisfy any such guard would mean that 
   the machine never progress to another state! In our CD player example, an automatic transition
    is defined for control state 3 (`Closing CD drawer`). According to the extended state of our 
    machine, the transition can have as target either the `CD Drawer Closed` or `CD Loaded` 
    control states.
  </dd>
  <dt>self transition</dt>
  <dd>Transitions can also occur with origin and destination the same conrol state. When 
  that happens, the transition is called a self transition.
  </dd>
  <dt>transition evaluation</dt>
  <dd>Given a machine in a given control state, and an external event occuring, the transitions 
  configured for that event are evaluated. This evaluation ends up in identifying a valid 
  transition, which is executed (e.g. taken) leading to a change in the current control state ; 
  or with no satisfying transition in which case the machine remains in the same control state, 
  with the same extended state.
  </dd>
  <dt>guards</dt>
  <dd>Guards associated to a transition are predicates which must be fulfilled for that 
  transition to be executed. Guards play an important role in connecting extended state to the  
  control flow for the computation under specification. As a matter of fact, in our context, guards 
  are pure functions of both the occurring event and extended state.
  </dd>
  <dt>action factory</dt>
  <dd>This is a notion linked to our implementation. An action factory is a function which 
  produces information about two actions to be performed upon executing a transition : update the
   encapsulated extended state for the state transducer, and possibly generate an output to its 
   caller. 
  </dd>
  <dt>output</dt>
  <dd>An output of the transducer is simply the value returned by the transducer upon receiving 
  an input (e.g. event). We will sometimes use the term *action* for output, as in the context of
   user interface specification, the output generated by our transducers will be actions on the 
   interfaced systems. Actions is quite the overloaded and polysemic terms though, so we will try
    as much as possible to use output when necessary to avoid confusion.
  </dd>
  <dt>composite state</dt>
  <dd>As previously presented, an hierarchical state machine may feature control states which may 
  themselves be hierarchical state machines. When that occurs, such control state will be called 
  a composite state. In our CD player example, the control state `CD loaded` is a composite state.
  </dd>
  <dt>compound state</dt>
  <dd>exact synonim of *composite state*
  </dd>
  <dt>nested state</dt>
  <dd>A control state which is part of a composite state
  </dd>
  <dt>atomic state</dt>
  <dd>An atomic state is a control state which is not itself a state machine. In other words, it 
  is a control state like in any standard state machine. In our base example, all states are 
  atomic states. In our CD player example, the control state 5 is an atomic state. The `CD 
  loaded` control state is not.
  </dd>
  <dt>transient state</dt>
  <dd>transient states are control states which are ephemeral. They are meant to be immediately 
  transitioned from. Transient state thus feature no external triggering event (but necessitates 
  of internal automatic event), and may have associated guards. By contract, one of these guards,
   if any, must be fulfilled to prevent the machine for eternally remain in the same control 
   state.   In our CD player example, the control state 3 is a transient state. Upon entering 
   that state, the machine will immediately transition to either control state 1, or composite 
   state `CD loaded`.
  </dd>
  <dt>terminal state</dt>
  <dd>the terminal state is a control state from which the machine is not meant to transition 
  from. This corresponds to a designed or anticipated end of run of the state machine.
  <dt>history state</dt>
  <dd>Semantics for the history state may vary according to the intended application of 
  hierarchical automata. In our restrictive context, the history state allows to transition back 
  to the previous control state that was previously transitioned away from. This makes sense 
  mostly in the context of composite states, which are themselves state machines and hence can be
   in one of several control states. In our CD player example, there are a few examples of 
   history states in the `CD loaded` composite state. For instance, if while being paused 
   (atomic control state 6), the user request the previous CD track, then the machine will 
   transition to... the same control state 6. The same is true if prior to the user request the 
   machine was in control state 4, 5, or 7. History state avoids having to write individual 
   transitions to each of those states from their parent composite state.
  </dd>
  <dt>entry point</dt>
  <dd>Entry points are the target of transitions which are taken when entering a given composite 
  state. This naturally only applies to transitions with origin a control state not included in the 
  composite state and destination a control state part of the composite state. An history state  
  can also be used as an entry point. In our CD player example, control state 1 is an entry point
   for the composite state `No CD loaded`. The same stands for `H` (history state) in `CD Loaded`
    composite state. Similarly a transition from `No CD loaded` to `CD loaded` will result in the
     machine ending in control state 4 (`CD stopped`) by virtue of a chain of entry points 
     leading to that control state.
  </dd>
</dl>

