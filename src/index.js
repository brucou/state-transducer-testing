import { constructGraph, depthFirstTraverseGraphEdges } from "graph-adt"
import { INIT_STATE } from "state-transducer"
import {
  computeHistoryState, getFsmStateList, getHistoryParentState, getHistoryType, isCompoundState, isEventless,
  isHistoryControlState, isHistoryStateEdge, isInitEvent, isInitState, isShallowHistory, lastOf, merge,
  reduceTransitions
} from "./helpers"
import { createStateMachine, traceFSM } from "state-transducer"
import { objectTreeLenses, PRE_ORDER, traverseObj } from "fp-rosetree"

const graphSettings = {
  getEdgeOrigin: edge => edge.from,
  getEdgeTarget: edge => edge.to,
  constructEdge: (originVertex, targetVertex) => ({ from: originVertex, to: targetVertex })
};

/**
 *
 * @param {FSM_Def} fsm Machine modelizing the system under test
 * @param {Generators} generators
 * @param {{ strategy: SearchStrategy, ubiquitous }} settings
 * `isTraversableEdge` tells us whether to continue the path construction. `isGoalReached` tells us when to
 * stop path accumulation and aggregate the current path to current results
 * @returns {Array<TestCase>}
 */
export function generateTestSequences(fsm, generators, settings) {
  const startingVertex = INIT_STATE;
  const tracedFSM = traceFSM({}, fsm);
  const fsmStates = tracedFSM.states;
  const analyzedStates = analyzeStateTree(fsmStates);
  const initialExtendedState = tracedFSM.initialExtendedState;
  // DOC : generated tests based on those events with explicit transitions defined (if the machine is complete, it is
  // all the same, but most of the time it is not)
  const { strategy: { isGoalReached, isTraversableEdge }, onResult } = settings;

  // Associate a gen to (from, event, guard index) = the transition it is mapped
  const genMap = getGeneratorMapFromGeneratorMachine(generators);

  // Build a graph from the tracedFSM, and the state machine triggering logic
  const fsmGraph = convertFSMtoGraph(tracedFSM);

  // search that graph with the right parameters
  const search = {
    initialGoalEvalState: { results: [] },
    showResults: graphTraversalState => graphTraversalState.results,
    evaluateGoal: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { results } = graphTraversalState;
      const bIsGoalReached = isGoalReached(edge, graph, pathTraversalState, graphTraversalState);
      const { inputSequence, outputSequence, controlStateSequence } = pathTraversalState;
      const newResults = bIsGoalReached
        ? results.concat([{ inputSequence, outputSequence, controlStateSequence }])
        : results;
      const newGraphTraversalState = { results: newResults };

      if (bIsGoalReached && onResult) onResult(newResults);

      return {
        isGoalReached: bIsGoalReached,
        graphTraversalState: newGraphTraversalState
      }
    },
  };
  const visit = {
    initialPathTraversalState: {
      path: [],
      controlStateSequence: [INIT_STATE],
      inputSequence: [],
      outputSequence: [],
      noMoreInput: false,
      outputIndex: 0,
      generatorState: null
    },
    visitEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      const trueEdge = edge.compound
        ? merge(edge, { from: edge.compound })
        : edge;
      // TODO : performance improvement : put extendedState computation inside each case, so I always compute it
      // only if necessary
      // NOTE : edge is a transition of the state machine
      const { inputSequence, generatorState } = pathTraversalState;
      // Execute the state machine with the input sequence to get it in the matching control state
      // Note that the machine has to be recreated each time, as it is a stateful object
      const fsm = createStateMachine(tracedFSM, settings);
      const tracedOutputs = lastOf(inputSequence.map(fsm));
      // We want the final extended state after miscellaneous updates on the transition path
      const extendedState = inputSequence.length === 0
        // Edge case : we are in INIT_STATE, the init event has the initial extended state as event data
        ? initialExtendedState
        // Main case : we run the sequence of inputs and
        // we take the extended state of the machine at the end of the run
        // lastOf(tracedOutputs) will have the result for execution of last input
        : lastOf(tracedOutputs).newExtendedState;

      // The generator is mapped to the original edge from the state machine transitions, so we use trueEdge
      const gen = getGeneratorMappedTransitionFromEdge(genMap, trueEdge);
      const generatedInput = gen
        ? gen(extendedState, generatorState)
        : { input: null, hasGeneratedInput: false, generatorState };
      // The traversability of an edge is based on the original edge from the state machine
      // transitions, so we use trueEdge
      const _isTraversableEdge = isTraversableEdge(trueEdge, graph, pathTraversalState, graphTraversalState);
      // Visit the edge
      const { newPathTraversalState, newIsTraversableEdge } =
        computeNewPathTraversalState(fsm, fsmStates, analyzedStates, edge, generatedInput, tracedOutputs, pathTraversalState, _isTraversableEdge);

      return {
        pathTraversalState: newPathTraversalState,
        isTraversableEdge: newIsTraversableEdge
      }
    }
  };
  const testCases = depthFirstTraverseGraphEdges(search, visit, startingVertex, fsmGraph);

  return testCases
}

function computeNewPathTraversalState(fsm, fsmStates, analyzedStates, edge, genInput, tracedOutputs, pathTraversalState,
                                      isTraversableEdge) {
  const { event: eventLabel, from: controlState } = edge;

  // .The state space to traverse is : origin state x event x target with
  // - origin in {init state, compound, atomic}
  // - event in {init event, eventless, eventful}
  // - target in {history, compound, atomic}
  // 3 x 3 x 3 cases theoretically but in fact :
  // - 3 x 3 x 2 because targt compound = target atomic
  // - 2 + 3 x 2 + 3 x 2 because only (init state, init event, compound) and (init state, init event, atomic)
  // - 2 + 0 + 3 x 2 because origin compound is not possible due to previously made graph transformation
  // - 2 + 0 + 2 x 2 because (atomic, init event, X) is not possible
  // So actually the case space is reduced from the theoretical 27 to 6 !!
  // .Get and run the input generator matching transition (origin state x event x target )
  // and update input and output sequences

  // Case 1 : origin control state is INIT_STATE and event is INIT_EVENT
  // Reminder : in INIT_STATE, the only event admissible is INIT_EVENT
  if (isInitState(controlState) && !isInitEvent(eventLabel)) {
    throw `computeNewPathTraversalState : cannot be in INIT_STATE and receive another event than INIT_EVENT! Check your fsm configuration!`
  }
  // Case 2. the init event is manually sent : we have to generate the corresponding input
  else if (isInitState(controlState) && isInitEvent(eventLabel)) {
    return computeGeneratedInfoDoNothingCase(edge, pathTraversalState)
  }
  // Case 3 : the init event is automatically and internally sent by the state machine : no need to generate inputs!
  else if (!isInitState(controlState) && isInitEvent(eventLabel)) {
    return computeGeneratedInfoDoNothingCase(edge, pathTraversalState)
  }
  else if (!isInitState(controlState) && !isInitEvent(eventLabel)) {
    // Case 4 : if eventless transition, the machine progress automatically,
    // so we have no input to generate to trigger a transition!
    if (isEventless(eventLabel)) {
      return computeGeneratedInfoEventlessCase(edge, tracedOutputs, isTraversableEdge, pathTraversalState)
    }
    // Case 5 : if history transition, input generation is depending on the actual history so far
    else if (isHistoryStateEdge(edge)) {
      return computeGeneratedInfoHistoryStateCase(fsm, fsmStates, edge, isTraversableEdge, genInput, pathTraversalState)
    }
    // general case 6 : not init state, not init event, not eventless, not history transition
    // i.e. normal state, normal event, normal transition (a compound or atomic target state are similar vs. test
    // generation)
    // So origin in {init, compound, atomic} x event in {init, eventless, eventful} x target in {history,
    // compound, atomic}
    else {
      return computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState)
    }
  }
}

function computeGeneratedInfoDoNothingCase(edge, pathTraversalState) {
  const { to: targetControlState } = edge;
  const { path, inputSequence, outputSequence, controlStateSequence, outputIndex, generatorState } = pathTraversalState;

  return {
    newIsTraversableEdge: true,
    newPathTraversalState: {
      inputSequence,
      // NOTE: reminder : intermediary states do not output! so no output to aggregate here
      outputSequence,
      controlStateSequence: controlStateSequence.concat([targetControlState]),
      path: path.concat([edge]),
      outputIndex,
      generatorState
    }
  }
}

function computeGeneratedInfoEventlessCase(edge, tracedOutputs, isTraversableEdge, pathTraversalState) {
  const { to: targetControlState, predicate } = edge;
  const { path, inputSequence, outputSequence, controlStateSequence, outputIndex, generatorState } = pathTraversalState;
  // We want the updated extended state, and the resulting output, so +1
  const { extendedState, outputs } = tracedOutputs[outputIndex + 1];
  const isGuardFulfilled = !predicate || predicate(extendedState);

  if (!isGuardFulfilled) {
    return {
      newIsTraversableEdge: false,
      newPathTraversalState: pathTraversalState
    }
  }
  else {
    return {
      newIsTraversableEdge: isTraversableEdge,
      newPathTraversalState: {
        inputSequence,
        outputSequence: outputSequence.concat(outputs),
        controlStateSequence: controlStateSequence.concat([targetControlState]),
        path: path.concat([edge]),
        outputIndex: outputIndex + 1,
        generatorState
      }
    }
  }
}

function computeGeneratedInfoHistoryStateCase(fsm, fsmStates, edge, isTraversableEdge, genInput, pathTraversalState) {
  const { to: targetControlState, history } = edge;
  const { controlStateSequence } = pathTraversalState;

  const historyParentState = getHistoryParentState(history);
  const historyType = getHistoryType(history);
  // We must compute the history state assuming edge.from is exited!
  // As edge.from is already in the control state sequence, we are good to call computeHistoryState
  const historyStateForParentState = computeHistoryState(fsmStates, controlStateSequence, historyType, historyParentState);

  // We have an history edge to evaluate, and the history target for that edge
  // does not correspond to the actual history state generated by the input sequence
  // No need to traverse that edge nor generate any inputs : this transition never happens
  if (historyStateForParentState !== targetControlState) {
    return {
      newIsTraversableEdge: false,
      newPathTraversalState: pathTraversalState
    }
  }
  // We have an history edge to evaluate, and the history target for that edge match the history
  // generated by the input sequence
  else {
    return computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState)
  }
}

function computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState) {
  const { event: eventLabel, from: controlState, to: targetControlState } = edge;
  const { path, inputSequence, outputSequence, controlStateSequence, generatorState } = pathTraversalState;
  const { input: newInputData, hasGeneratedInput, generatorState: newGeneratorState } = genInput;
  let noMoreInput, newInputSequence, newOutputSequence, newControlStateSequence, newPath;

  // There is no way to generate an input for that transition : invalid transition
  // This could be the case when the extended state generated by the input sequence invalidates the transition guard
  if (!hasGeneratedInput) {
    noMoreInput = true;
    newInputSequence = inputSequence;
    newOutputSequence = outputSequence;
    newControlStateSequence = controlStateSequence;
    newPath = path;
  }
  // We generated an input for that transition : add that to the generated input sequence
  else {
    const newInput = { [eventLabel]: newInputData };
    newInputSequence = inputSequence.concat([newInput]);
    // NOTE : fsm will always return as output an array with exactly one item in the base case!
    const newOutput = fsm(newInput)[0];
    // NOTE : finalControlState is the control state at the end of the associated automatic transitions, if any
    // A -INIT> B -INIT> C ; edge : [A -INIT> B] => finalControlState = C, targetControlState = B
    const { outputs: untracedOutput, targetControlState: finalControlState } = newOutput;

    newOutputSequence = outputSequence.concat([untracedOutput]);
    newControlStateSequence = controlStateSequence.concat([targetControlState]);
    newPath = path.concat([edge]);
    noMoreInput = false;
  }

  return {
    newIsTraversableEdge: !noMoreInput && isTraversableEdge,
    newPathTraversalState: {
      inputSequence: newInputSequence,
      outputSequence: newOutputSequence,
      controlStateSequence: newControlStateSequence,
      path: newPath,
      outputIndex: 0,
      // DOC : !!! undefined value for generator state means that we keep the same generator state. Use null if cancel
      generatorState: newGeneratorState !== undefined ? newGeneratorState : generatorState
    }
  }
}

/**
 * @param {Generators} generators
 */
export function getGeneratorMapFromGeneratorMachine(generators) {
  return reduceTransitions((acc, transition, guardIndex, transitionIndex) => {
    const { from, event, gen } = transition;
    acc.set(JSON.stringify({ from, event, guardIndex }), gen);
    return acc
  }, new Map(), generators)
}

/**
 * Returns the graph structure associated to the FSM. The graph is constructed from the state machines transitions,
 * with a reduction mechanism applied : transitions which have as origin a compound state are flattened
 * @param {FSM_Def} tracedFSM
 * @returns Graph
 */
export function convertFSMtoGraph(tracedFSM) {
  const { transitions, states } = tracedFSM;
  const vertices = Object.keys(getFsmStateList(states)).concat(INIT_STATE);
  // The trace set of H(A) are the direct children of A, i.e. statesAdjacencyList
  // The trace set of H*(A) are the descendents of A which are leaves, i.e. statesLeafChildrenList
  const { statesAdjacencyList, statesLeafChildrenList } = analyzeStateTree(states);
  const edges = reduceTransitions((acc, transition, guardIndex, transitionIndex) => {
    const { from, event, to, action, predicate } = transition;
    const transitionRecord = { from, event, action, predicate, to, guardIndex, transitionIndex };
    const isOriginStateCompound = isCompoundState({ statesAdjacencyList, statesLeafChildrenList }, from);
    const isOriginStateAtomic = !isOriginStateCompound;
    const isTargetStateCompound = isCompoundState({ statesAdjacencyList, statesLeafChildrenList }, to);
    const isTargetStateAtomic = !isTargetStateCompound;
    const isHistoryState = isHistoryControlState(to);

    // We have cyclomatic complexity = 11 branches??!!!

    // Terminology :
    // - Trace set of f : set of all possible values that can be taken by f (i.e. f image)
    // Reminder : history states are always atomic target states
    // Algorithm :
    // 1. If A = [A1,A2,A3] is a compound state, A -INIT> X is created as per the configured transitions
    // 2. If A = [A1,A2,A3] is a compound state, and X is such that A -ev> X, with ev != INIT
    // then the edges will be created : A1 -ev> X, A2 -ev> X, A3 -ev> X
    // 3. If A -ev> H | H*, then the trace set of H | H* is computed, and this is dealt with as
    //   If A -ev> trace(H) | trace(H*)
    // Otherwise edges are created as per the configured transitions
    // NOTE : because 1, 2, and 3 may intersect, for better maintainability and safety,
    // we structure the code by the disjoint `if` branches from the `origin x target` space,
    // with origin and target taking values in [atomic, compound] and identifiy cases 1,2,3 each time
    if (isOriginStateAtomic && isTargetStateAtomic) {
      if (isHistoryState) {
        const historyParentState = getHistoryParentState(to);
        const traceHistorySet = isShallowHistory(to)
          ? statesAdjacencyList[historyParentState]
          : statesLeafChildrenList[historyParentState];

        return acc.concat(traceHistorySet.map(state => merge(transitionRecord, { to: state, history: to })))
      }
      else {
        return acc.concat(transitionRecord)
      }
    }
    else if (isOriginStateAtomic && isTargetStateCompound) {
      return acc.concat(transitionRecord)
    }
    else if (isOriginStateCompound && isTargetStateAtomic) {
      const childrenStates = statesLeafChildrenList[from];
      const origins = childrenStates.map(state => merge(transitionRecord, { from: state, compound: from }));

      if (isInitEvent(event)) {
        return acc.concat(transitionRecord)
      }
      else if (isHistoryState) {
        const historyParentState = getHistoryParentState(to);
        const traceHistorySet = isShallowHistory(to)
          ? statesAdjacencyList[historyParentState]
          : statesLeafChildrenList[historyParentState];
        const transitions = traceHistorySet.reduce((acc, possibleHistState) => {
          return origins.reduce((acc2, origin) => {
            return acc2.concat(merge(origin, { to: possibleHistState, history: to }))
          }, acc)
        }, []);

        return acc.concat(transitions)
      }
      else {
        return acc.concat(origins);
      }
    }
    else if (isOriginStateCompound && isTargetStateCompound) {
      if (isInitEvent(event)) {
        return acc.concat(transitionRecord)
      }
      else {
        const childrenStates = statesLeafChildrenList[from];
        const origins = childrenStates.map(state => merge(transitionRecord, { from: state, compound: from }));

        return acc.concat(origins);
      }
    }
  }, [], transitions);

  return constructGraph(graphSettings, edges, vertices)
}

/**
 * For a given state hierarchy, return a map associating, for every control state, its direct substates, and its
 * children which are atomic states
 * @param {FSM_States} states
 * @returns {{statesAdjacencyList: Object.<ControlState, Array<ControlState>>, statesLeafChildrenList:
 *   Object.<ControlState, Array<ControlState>>}}
 */
export function analyzeStateTree(states) {
  const { getLabel, getChildren, isLeafLabel } = objectTreeLenses;
  const traverse = {
    strategy: PRE_ORDER,
    seed: { statesAdjacencyList: {}, leaveStates: {} },
    visit: (acc, traversalState, tree) => {
      const { path } = traversalState.get(tree);
      const treeLabel = getLabel(tree);
      const controlState = Object.keys(treeLabel)[0];
      acc.statesAdjacencyList[controlState] = getChildren(tree).map(x => Object.keys(x)[0]);
      if (isLeafLabel(treeLabel)) {
        acc.leaveStates[path.join('.')] = controlState;
      }

      return acc;
    }
  };
  const { statesAdjacencyList, leaveStates } = traverseObj(traverse, states);

  const leavePathsStr = Object.keys(leaveStates);
  const traverseAgain = {
    strategy: PRE_ORDER,
    seed: { statesLeafChildrenList: {} },
    visit: (acc, traversalState, tree) => {
      const { path } = traversalState.get(tree);
      const pathStr = path.join('.');
      const treeLabel = getLabel(tree);
      const controlState = Object.keys(treeLabel)[0];
      acc.statesLeafChildrenList[controlState] = [];
      leavePathsStr.filter(x => x !== pathStr).filter(x => x.startsWith(pathStr)).forEach(pathStr => {
        acc.statesLeafChildrenList[controlState].push(leaveStates[pathStr]);
      });

      return acc;
    }
  };
  const { statesLeafChildrenList } = traverseObj(traverseAgain, states);

  return {
    statesAdjacencyList,
    statesLeafChildrenList
  }
}

function getGeneratorMappedTransitionFromEdge(genMap, edge) {
  const { from, event, guardIndex } = edge;
  return genMap.get(JSON.stringify({ from, event, guardIndex }))
}

export function testFsm({ testAPI, fsmFactorySpecs, inputSequences, oracle, format }) {
  const getInputKey = function getInputKey(input) {return Object.keys(input)[0]};
  const { assert } = testAPI;
  const { formatOutputsSequences } = format;
  const { fsmDef, factorySettings, createStateMachine } = fsmFactorySpecs;
  const { computeOutputSequences } = oracle;

  const formattedInputSequences = inputSequences.map(inputSequence => inputSequence.map(getInputKey).join(' -> '));

  const outputsSequences = inputSequences.map(testSequence => {
    const fsm = createStateMachine(fsmDef, factorySettings);
    const output = testSequence.map(fsm);
    return output
  });
  const formattedOutputsSequences = formatOutputsSequences(outputsSequences);

  const expectedOutputSequences = computeOutputSequences(inputSequences);

  inputSequences.forEach((_, index) => {
    assert.deepEqual(
      formattedOutputsSequences[index],
      expectedOutputSequences[index],
      formattedInputSequences[index]
    );
  })
}

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
 * @typedef {{inputSequence: InputSequence, outputSequence:OutputSequence, controlStateSequence:ControlStateSequence}}
 *   TestCase
 */
/**
 * @typedef {Array<LabelledEvent>} InputSequence
 */
/**
 * @typedef {Array<Array<MachineOutput>>} OutputSequence
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

