// Ramda fns
import { DEEP, HISTORY_PREFIX, HISTORY_STATE_NAME, INIT_EVENT, INIT_STATE, NO_OUTPUT, SHALLOW } from "state-transducer"
import { objectTreeLenses, PRE_ORDER, traverseObj } from "fp-rosetree"

export function merge(a, b) {
  return Object.assign({}, a, b)
}

// Contracts
/** @type ActionFactory*/
export function identity(extendedState, eventData, settings) {
  return {
    updates: [],
    outputs: NO_OUTPUT
  }
}

export function lastOf(arr) {
  return arr[arr.length - 1];
}

function formatActionName(action, from, event, to, predicate) {
  const predicateName = predicate ? predicate.name : "";
  const formattedPredicate = predicateName ? `[${predicateName}]` : "";
  const actionName = action ? action.name : "identity";
  const formattedAction = actionName ? actionName : "unnamed action";
  return `${formattedAction}:${from}-${event}->${to} ${formattedPredicate}`;
}

export function getFsmStateList(states) {
  const { getLabel } = objectTreeLenses;
  const traverse = {
    strategy: PRE_ORDER,
    seed: {},
    visit: (accStateList, traversalState, tree) => {
      const treeLabel = getLabel(tree);
      const controlState = Object.keys(treeLabel)[0];
      accStateList[controlState] = "";

      return accStateList;
    }
  };
  const stateHashMap = traverseObj(traverse, states);

  // add history states
  stateHashMap.constructor
  return stateHashMap
}

export function computeHistoryMaps(control_states) {
  if (Object.keys(control_states).length === 0) {throw `computeHistoryMaps : passed empty control states parameter?`}

  const { getLabel, isLeafLabel } = objectTreeLenses;
  const traverse = {
    strategy: PRE_ORDER,
    seed: { stateList: [], stateAncestors: { [DEEP]: {}, [SHALLOW]: {} } },
    visit: (acc, traversalState, tree) => {
      const treeLabel = getLabel(tree);
      const controlState = Object.keys(treeLabel)[0];
      acc.stateList = acc.stateList.concat(controlState);

      // NOTE : we don't have to worry about path having only one element
      // that case correspond to the root of the tree which is excluded from visiting
      const { path } = traversalState.get(tree);
      traversalState.set(JSON.stringify(path), controlState);
      const parentPath = path.slice(0, -1);
      if (parentPath.length === 1) {
        // That's the root
        traversalState.set(JSON.stringify(parentPath), INIT_STATE);
      }
      else {
        const parentControlState = traversalState.get(JSON.stringify(parentPath));
        acc.stateAncestors[SHALLOW][controlState] = [parentControlState];

        const { ancestors } = path.reduce((acc, _) => {
          const parentPath = acc.path.slice(0, -1);
          acc.path = parentPath;
          if (parentPath.length > 1) {
            const parentControlState = traversalState.get(JSON.stringify(parentPath));
            acc.ancestors = acc.ancestors.concat(parentControlState);
          }

          return acc
        }, { ancestors: [], path });
        acc.stateAncestors[DEEP][controlState] = ancestors;
      }

      return acc
    }
  };
  const { stateList, stateAncestors } = traverseObj(traverse, control_states);

  return { stateList, stateAncestors }
}

export function reduceTransitions(reduceFn, seed, transitions) {
  const result = transitions.reduce((acc, transitionStruct, transitionIndex) => {
    let { from, event, to, gen, action, guards } = transitionStruct;
    // Edge case when no guards are defined
    if (!guards) {
      guards = gen ? [{ to, action, gen, predicate: undefined }] : [{ to, action, predicate: undefined }]
    }
    return guards.reduce((acc, guard, guardIndex) => {
      const { to, action, gen, predicate } = guard;
      return gen
        ? reduceFn(acc, { from, event, to, action, predicate, gen }, guardIndex, transitionIndex)
        : reduceFn(acc, { from, event, to, action, predicate }, guardIndex, transitionIndex)
    }, acc);
  }, seed);

  return result
}

export function computeTimesCircledOn(edgePath, edge) {
  return edgePath.reduce((acc, edgeInEdgePath) => edgeInEdgePath === edge ? acc + 1 : acc, 0);
}

export function isInitState(s) {return s === INIT_STATE}

export function isInitEvent(e) {return e === INIT_EVENT}

export function isEventless(e) {return typeof e === 'undefined'}

export function arrayizeOutput(output) {
  return output === NO_OUTPUT
    ? NO_OUTPUT
    : Array.isArray(output)
      ? output
      : [output]
}

export function isHistoryControlState(to) {
  return typeof to === 'object' && (DEEP in to || SHALLOW in to)
}

export function getHistoryParentState(to) {
  return to[SHALLOW] || to[DEEP]
}

export function isShallowHistory(to) {
  return to[SHALLOW]
}

export function isDeepHistory(to) {
  return to[DEEP]
}

export function getHistoryType(history) {
  return history[DEEP] ? DEEP : SHALLOW
}

export function isHistoryStateEdge(edge) {
  return typeof edge.history !== 'undefined'
}

/**
 * Creates a history object from a state list. The created history object represents the history states when no
 * control states have been entered or exited.
 * @param stateList
 * @returns {History}
 */
export function initHistoryDataStructure(stateList) {
  // NOTE : we update history in place, so we need two different objects here, even
  // when they start with the same value
  const initHistory = () => stateList.reduce((acc, state) => (acc[state] = '', acc), {});
  return { [DEEP]: initHistory(), [SHALLOW]: initHistory() };
}

export function isCompoundState(analyzedStates, controlState) {
  const { statesAdjacencyList } = analyzedStates;
  return statesAdjacencyList[controlState] && statesAdjacencyList[controlState].length !== 0
}

export function isAtomicState(analyzedStates, controlState) {
  return !isCompoundState(analyzedStates, controlState)
}

/**
 * Updates the history state (both deep and shallow) after `state_from_name` has been exited. Impacted states are the
 * `stateAncestors` which are the ancestors for the exited state.
 * @param {History} history Contains deep history and shallow history for all
 * control states, except the INIT_STATE (not that the concept has no value for atomic state). The function
 * `updateHistory` allows to update the history as transitions occur in the state machine.
 * @param {Object.<DEEP|SHALLOW, Object.<ControlState, Array<ControlState>>>} stateAncestors
 * @returns {History}
 * @modifies history
 */
export function updateHistory(history, stateAncestors, state_from_name) {
  // Edge case, we start with INIT_STATE but that is not kept in the history (no transition to it!!)

  if (state_from_name === INIT_STATE) {
    return history
  }
  else {
    [SHALLOW, DEEP].forEach(historyType => {
      // ancestors for the state which is exited
      const ancestors = stateAncestors[historyType][state_from_name] || [];
      ancestors.forEach(ancestor => {
        // set the exited state in the history of all ancestors
        history[historyType][ancestor] = state_from_name
      });
    });

    return history
  }
}

/**
 * for all parentState, computes history(parentState), understood as the last control state descending from the
 * parent state. Last can be understood two ways : DEEP and SHALLOW. Deep history state refer to the last atomic
 * control state which is a children of the parent state and was exited. Shallow history states refer to the last
 * control state which is a direct child of the parent state and was exited.
 * @param {FSM_States} states
 * @param {Array<ControlState>} controlStateSequence Sequence of control states which has been entered and exited,
 * and from which the history must be computed
 * @param {DEEP | SHALLOW} historyType
 * @param {ControlState} historyParentState
 * @returns {Object.<DEEP|SHALLOW, Object.<ControlState, ControlState>>}
 */
export function computeHistoryState(states, controlStateSequence, historyType, historyParentState) {
  // NOTE : we compute the whole story every time. This is inefficient, but for now sufficient
  const { stateList, stateAncestors } = computeHistoryMaps(states);
  let history = initHistoryDataStructure(stateList);
  history = controlStateSequence.reduce(
    (history, controlState) => updateHistory(history, stateAncestors, controlState),
    history
  );

  return history[historyType][historyParentState]
}
