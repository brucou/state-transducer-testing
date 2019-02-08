import * as QUnit from "qunitjs"
import { clone, F, merge, T } from "ramda"
import {
  ACTION_IDENTITY, analyzeStateTree, computeHistoryMaps, INIT_EVENT, INIT_STATE, makeHistoryStates,
  mapOverTransitionsActions, reduceTransitions, SHALLOW, DEEP
} from "state-transducer"
import { formatMap, formatResult } from "./helpers"
import { convertFSMtoGraph, getGeneratorMapFromGeneratorMachine } from "../src/index"

const a_value = "some value";
const another_value = "another value";
const an_output = {
  outputKey1: 'outputValue1'
};
const another_output = {
  anotherOutputKey1: 'anotherOutputValue1'
};
const model_initial = {
  a_key: a_value,
  another_key: another_value
};
const replaced_model_property = {
  new_model_key: 'new_model_value'
}
const update_model_ops_1 = [
  { op: "add", path: '/new_model_key_1', value: 'new_model_value_1' },
  { op: "replace", path: '/a_key', value: replaced_model_property },
  { op: "remove", path: '/another_key' },
];
const update_model_ops_2 = [
  { op: "add", path: '/new_model_key_2', value: 'new_model_value_2' },
];
const dummy_action_result_with_update = {
  updates: update_model_ops_1,
  outputs: an_output
};
const another_dummy_action_result_with_update = {
  updates: update_model_ops_2,
  outputs: another_output
};
const EVENT1 = 'event1';
const EVENT2 = 'event2';
const EVENT3 = 'event3';
const EVENT4 = 'event4';
const EVENT5 = 'event5';

function incCounter(extS, eventData) {
  const { counter } = extS;

  return {
    updates: [{ op: 'add', path: '/counter', value: counter + 1 }],
    outputs: counter
  }
}

function incCounterTwice(extS, eventData) {
  const { counter } = extS;

  return {
    updates: [{ op: 'add', path: '/counter', value: counter + 2 }],
    outputs: counter
  }
}

function dummy_action_with_update(model, event_data, settings) {
  return merge(dummy_action_result_with_update, {
    outputs: {
      // NOTE : ! this is the model before update!!
      model: clone(model),
      event_data: clone(event_data),
      settings: JSON.parse(JSON.stringify(settings))
    }
  })
}

function another_dummy_action_with_update(model, event_data, settings) {
  return merge(another_dummy_action_result_with_update, {
      outputs: {
        // NOTE : ! this is the model before update!!
        model: clone(model),
        event_data: clone(event_data),
        settings: JSON.parse(JSON.stringify(settings))
      }
    }
  )
}

const reduceFn = (acc, transitionStruct, guardIndex, transitionIndex) => {
  return acc.concat({ transitionStruct, guardIndex, transitionIndex })
};
const mapFn = (action, transition, guardIndex, transitionIndex) => {
  return function () {}
};

QUnit.module("Testing reduceTransitions(reduceFn, seed, transitions)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initialExtendedState: model_initial
  };
  const result = reduceTransitions(reduceFn, [], fsmDef.transitions).map(formatResult);
  assert.deepEqual(result, [
    {
      "guardIndex": 0,
      "transitionIndex": 0,
      "transitionStruct": {
        "action": "ACTION_IDENTITY",
        "event": "init",
        "from": "nok",
        "predicate": undefined,
        "to": "A"
      }
    }
  ], `reduce transition when no guards are specified`);
});

QUnit.test("INIT event, 2 actions, [F,T] conditions, 2nd action executed", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: F, to: 'A', action: ACTION_IDENTITY },
          { predicate: T, to: 'A', action: ACTION_IDENTITY }
        ]
      }
    ],
    initialExtendedState: model_initial
  };
  const result = reduceTransitions(reduceFn, [], fsmDef.transitions).map(formatResult);
  assert.deepEqual(result, [
      {
        "guardIndex": 0,
        "transitionIndex": 0,
        "transitionStruct": {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "nok",
          "predicate": "anonymous",
          "to": "A"
        }
      },
      {
        "guardIndex": 1,
        "transitionIndex": 0,
        "transitionStruct": {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "nok",
          "predicate": "anonymous",
          "to": "A"
        }
      }
    ],
    `reduce transition when guards are specified`);
});

QUnit.test("INIT event, 2 actions with model update, NOK -> A -> B, no guards", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: dummy_action_with_update },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action_with_update },
    ],
    initialExtendedState: model_initial
  };
  const result = reduceTransitions(reduceFn, [], fsmDef.transitions).map(formatResult);
  assert.deepEqual(result, [
    {
      "guardIndex": 0,
      "transitionIndex": 0,
      "transitionStruct": {
        "action": "dummy_action_with_update",
        "event": "init",
        "from": "nok",
        "predicate": undefined,
        "to": "A"
      }
    },
    {
      "guardIndex": 0,
      "transitionIndex": 1,
      "transitionStruct": {
        "action": "another_dummy_action_with_update",
        "event": "event1",
        "from": "A",
        "predicate": undefined,
        "to": "B"
      }
    }
  ], `event triggers correct transition`);
});

QUnit.module("Testing mapOverTransitionsActions(mapFn, transitions)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initialExtendedState: model_initial
  };
  const result = mapOverTransitionsActions(mapFn, fsmDef.transitions).map(formatResult);
  assert.deepEqual(result, [
    {
      "action": "ACTION_IDENTITY",
      "event": "init",
      "from": "nok",
      "to": "A"
    }
  ], `reduce transition when no guards are specified`);
});

QUnit.test("INIT event, 2 actions, [F,T] conditions, 2nd action executed", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: F, to: 'A', action: ACTION_IDENTITY },
          { predicate: T, to: 'A', action: ACTION_IDENTITY }
        ]
      }
    ],
    initialExtendedState: model_initial
  };
  const result = mapOverTransitionsActions(mapFn, fsmDef.transitions)
    .map(({ event, from, guards }) => ({ event, from, guards: guards.map(formatResult) }));
  assert.deepEqual(result,
    [
      {
        "event": "init",
        "from": "nok",
        "guards": [
          {
            "action": "ACTION_IDENTITY",
            "predicate": "anonymous",
            "to": "A"
          },
          {
            "action": "ACTION_IDENTITY",
            "predicate": "anonymous",
            "to": "A"
          }
        ]
      }
    ],
    `reduce transition when guards are specified`);
});

QUnit.test("INIT event, 2 actions with model update, NOK -> A -> B, no guards", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: dummy_action_with_update },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action_with_update },
    ],
    initialExtendedState: model_initial
  };
  const result = mapOverTransitionsActions(mapFn, fsmDef.transitions).map(formatResult);
  assert.deepEqual(result,
    [
      {
        "action": "dummy_action_with_update",
        "event": "init",
        "from": "nok",
        "to": "A"
      },
      {
        "action": "another_dummy_action_with_update",
        "event": "event1",
        "from": "A",
        "to": "B"
      }
    ], `event triggers correct transition`);
});

QUnit.module("Testing convertFSMtoGraph(tracedFSM)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initialExtendedState: model_initial
  };
  const result = formatResult(convertFSMtoGraph(fsmDef));
  assert.deepEqual(result, {
    "clear": "clear",
    "edges": [
      {
        "action": "ACTION_IDENTITY",
        "event": "init",
        "from": "nok",
        "guardIndex": 0,
        "predicate": undefined,
        "to": "A",
        "transitionIndex": 0
      }
    ],
    "getEdgeOrigin": "getEdgeOrigin",
    "getEdgeTarget": "getEdgeTarget",
    "incomingEdges": "incomingEdges",
    "outgoingEdges": "outgoingEdges",
    "showEdge": "showEdge",
    "showVertex": "showVertex",
    "vertices": [
      "A",
      "nok"
    ]
  }, `...`);
});

QUnit.test("INIT event, 2 actions, [F,T] conditions, 2nd action executed", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: F, to: 'A', action: ACTION_IDENTITY },
          { predicate: T, to: 'A', action: ACTION_IDENTITY }
        ]
      }
    ],
    initialExtendedState: model_initial
  };
  const result = formatResult(convertFSMtoGraph(fsmDef));
  assert.deepEqual(result, {
      "clear": "clear",
      "edges": [
        {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "nok",
          "guardIndex": 0,
          "predicate": "anonymous",
          "to": "A",
          "transitionIndex": 0
        },
        {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "nok",
          "guardIndex": 1,
          "predicate": "anonymous",
          "to": "A",
          "transitionIndex": 0
        }
      ],
      "getEdgeOrigin": "getEdgeOrigin",
      "getEdgeTarget": "getEdgeTarget",
      "incomingEdges": "incomingEdges",
      "outgoingEdges": "outgoingEdges",
      "showEdge": "showEdge",
      "showVertex": "showVertex",
      "vertices": [
        "A",
        "nok"
      ]
    },
    `...`);
});

QUnit.test("INIT event, 2 actions with model update, NOK -> A -> B, no guards", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: dummy_action_with_update },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action_with_update },
    ],
    initialExtendedState: model_initial
  };
  const result = formatResult(convertFSMtoGraph(fsmDef));
  assert.deepEqual(result, {
    "clear": "clear",
    "edges": [
      {
        "action": "dummy_action_with_update",
        "event": "init",
        "from": "nok",
        "guardIndex": 0,
        "predicate": undefined,
        "to": "A",
        "transitionIndex": 0
      },
      {
        "action": "another_dummy_action_with_update",
        "event": "event1",
        "from": "A",
        "guardIndex": 0,
        "predicate": undefined,
        "to": "B",
        "transitionIndex": 1
      }
    ],
    "getEdgeOrigin": "getEdgeOrigin",
    "getEdgeTarget": "getEdgeTarget",
    "incomingEdges": "incomingEdges",
    "outgoingEdges": "outgoingEdges",
    "showEdge": "showEdge",
    "showVertex": "showVertex",
    "vertices": [
      "A",
      "B",
      "nok"
    ]
  }, `event triggers correct transition`);
});

// NOTE : did not test compound to compound!
QUnit.test("whth history states deep and shallow", function exec_test(assert) {
  const OUTER = 'OUTER';
  const INNER = 'INNER';
  const OUTER_A = 'outer_a';
  const OUTER_B = 'outer_b';
  const INNER_S = 'inner_s';
  const INNER_T = 'inner_t';
  const Z = 'z';
  const states = { [OUTER]: { [INNER]: { [INNER_S]: '', [INNER_T]: '' }, [OUTER_A]: '', [OUTER_B]: '' }, [Z]: '' };
  const hs = makeHistoryStates(states);
  const fsmDef = {
    states,
    events: [EVENT1, EVENT2, EVENT3, EVENT4, EVENT5],
    initialExtendedState: { history: SHALLOW, counter: 0 },
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: OUTER, action: ACTION_IDENTITY },
      { from: OUTER, event: INIT_EVENT, to: OUTER_A, action: ACTION_IDENTITY },
      { from: OUTER_A, event: EVENT1, to: INNER, action: ACTION_IDENTITY },
      { from: INNER, event: INIT_EVENT, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER_S, event: EVENT3, to: INNER_T, action: ACTION_IDENTITY },
      { from: INNER_T, event: EVENT3, to: INNER_S, action: ACTION_IDENTITY },
      {
        from: INNER_T, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs(DEEP, OUTER),
            action: incCounterTwice
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs(SHALLOW, OUTER),
            action: incCounterTwice
          }
        ]
      },
      { from: INNER, event: EVENT2, to: OUTER_B, action: ACTION_IDENTITY },
      { from: OUTER, event: EVENT5, to: Z, action: ACTION_IDENTITY },
      {
        from: Z, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs(DEEP, OUTER),
            action: incCounter
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs(SHALLOW, OUTER),
            action: incCounter
          }
        ]
      },
    ],
  };
  const result = formatResult(convertFSMtoGraph(fsmDef));
  assert.deepEqual(result,
    {
      "clear": "clear",
      "edges": [
        {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "nok",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "OUTER",
          "transitionIndex": 0
        },
        {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "OUTER",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "outer_a",
          "transitionIndex": 1
        },
        {
          "action": "ACTION_IDENTITY",
          "event": "event1",
          "from": "outer_a",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "INNER",
          "transitionIndex": 2
        },
        {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "INNER",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "inner_s",
          "transitionIndex": 3
        },
        {
          "action": "ACTION_IDENTITY",
          "event": "event3",
          "from": "inner_s",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "inner_t",
          "transitionIndex": 4
        },
        {
          "action": "ACTION_IDENTITY",
          "event": "event3",
          "from": "inner_t",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "inner_s",
          "transitionIndex": 5
        },
        {
          "action": "incCounterTwice",
          "event": "event4",
          "from": "inner_t",
          "guardIndex": 0,
          "history": {
            "deep": "OUTER",
            "type": {}
          },
          "predicate": "isDeep",
          "to": "inner_s",
          "transitionIndex": 6
        },
        {
          "action": "incCounterTwice",
          "event": "event4",
          "from": "inner_t",
          "guardIndex": 0,
          "history": {
            "deep": "OUTER",
            "type": {}
          },
          "predicate": "isDeep",
          "to": "inner_t",
          "transitionIndex": 6
        },
        {
          "action": "incCounterTwice",
          "event": "event4",
          "from": "inner_t",
          "guardIndex": 0,
          "history": {
            "deep": "OUTER",
            "type": {}
          },
          "predicate": "isDeep",
          "to": "outer_a",
          "transitionIndex": 6
        },
        {
          "action": "incCounterTwice",
          "event": "event4",
          "from": "inner_t",
          "guardIndex": 0,
          "history": {
            "deep": "OUTER",
            "type": {}
          },
          "predicate": "isDeep",
          "to": "outer_b",
          "transitionIndex": 6
        },
        {
          "action": "incCounterTwice",
          "event": "event4",
          "from": "inner_t",
          "guardIndex": 1,
          "history": {
            "shallow": "OUTER",
            "type": {}
          },
          "predicate": "isShallow",
          "to": "INNER",
          "transitionIndex": 6
        },
        {
          "action": "incCounterTwice",
          "event": "event4",
          "from": "inner_t",
          "guardIndex": 1,
          "history": {
            "shallow": "OUTER",
            "type": {}
          },
          "predicate": "isShallow",
          "to": "outer_a",
          "transitionIndex": 6
        },
        {
          "action": "incCounterTwice",
          "event": "event4",
          "from": "inner_t",
          "guardIndex": 1,
          "history": {
            "shallow": "OUTER",
            "type": {}
          },
          "predicate": "isShallow",
          "to": "outer_b",
          "transitionIndex": 6
        },
        {
          "action": "ACTION_IDENTITY",
          "compound": "INNER",
          "event": "event2",
          "from": "inner_s",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "outer_b",
          "transitionIndex": 7
        },
        {
          "action": "ACTION_IDENTITY",
          "compound": "INNER",
          "event": "event2",
          "from": "inner_t",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "outer_b",
          "transitionIndex": 7
        },
        {
          "action": "ACTION_IDENTITY",
          "compound": "OUTER",
          "event": "event5",
          "from": "inner_s",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "z",
          "transitionIndex": 8
        },
        {
          "action": "ACTION_IDENTITY",
          "compound": "OUTER",
          "event": "event5",
          "from": "inner_t",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "z",
          "transitionIndex": 8
        },
        {
          "action": "ACTION_IDENTITY",
          "compound": "OUTER",
          "event": "event5",
          "from": "outer_a",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "z",
          "transitionIndex": 8
        },
        {
          "action": "ACTION_IDENTITY",
          "compound": "OUTER",
          "event": "event5",
          "from": "outer_b",
          "guardIndex": 0,
          "predicate": undefined,
          "to": "z",
          "transitionIndex": 8
        },
        {
          "action": "incCounter",
          "event": "event4",
          "from": "z",
          "guardIndex": 0,
          "history": {
            "deep": "OUTER",
            "type": {}
          },
          "predicate": "isDeep",
          "to": "inner_s",
          "transitionIndex": 9
        },
        {
          "action": "incCounter",
          "event": "event4",
          "from": "z",
          "guardIndex": 0,
          "history": {
            "deep": "OUTER",
            "type": {}
          },
          "predicate": "isDeep",
          "to": "inner_t",
          "transitionIndex": 9
        },
        {
          "action": "incCounter",
          "event": "event4",
          "from": "z",
          "guardIndex": 0,
          "history": {
            "deep": "OUTER",
            "type": {}
          },
          "predicate": "isDeep",
          "to": "outer_a",
          "transitionIndex": 9
        },
        {
          "action": "incCounter",
          "event": "event4",
          "from": "z",
          "guardIndex": 0,
          "history": {
            "deep": "OUTER",
            "type": {}
          },
          "predicate": "isDeep",
          "to": "outer_b",
          "transitionIndex": 9
        },
        {
          "action": "incCounter",
          "event": "event4",
          "from": "z",
          "guardIndex": 1,
          "history": {
            "shallow": "OUTER",
            "type": {}
          },
          "predicate": "isShallow",
          "to": "INNER",
          "transitionIndex": 9
        },
        {
          "action": "incCounter",
          "event": "event4",
          "from": "z",
          "guardIndex": 1,
          "history": {
            "shallow": "OUTER",
            "type": {}
          },
          "predicate": "isShallow",
          "to": "outer_a",
          "transitionIndex": 9
        },
        {
          "action": "incCounter",
          "event": "event4",
          "from": "z",
          "guardIndex": 1,
          "history": {
            "shallow": "OUTER",
            "type": {}
          },
          "predicate": "isShallow",
          "to": "outer_b",
          "transitionIndex": 9
        }
      ],
      "getEdgeOrigin": "getEdgeOrigin",
      "getEdgeTarget": "getEdgeTarget",
      "incomingEdges": "incomingEdges",
      "outgoingEdges": "outgoingEdges",
      "showEdge": "showEdge",
      "showVertex": "showVertex",
      "vertices": [
        "OUTER",
        "INNER",
        "inner_s",
        "inner_t",
        "outer_a",
        "outer_b",
        "z",
        "nok"
      ]
    }, `...`);
});

QUnit.module("Testing getGeneratorMapFromGeneratorMachine(generators)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, to: 'A', event: INIT_EVENT, gen: function genFn(extendedState) {
          // does not matter
        }
      }
    ],
    initialExtendedState: model_initial
  };
  const generators = fsmDef.transitions;
  const result = formatMap(getGeneratorMapFromGeneratorMachine(generators));
  assert.deepEqual(result, [
    [
      "{\"from\":\"nok\",\"event\":\"init\",\"guardIndex\":0}",
      "genFn"
    ]
  ], `...`);
});

QUnit.module("Testing computeHistoryMaps(control_states)", {});

const OUTER = 'OUTER';
const INNER = 'INNER';
const OUTER_A = 'outer_a';
const OUTER_B = 'outer_b';
const INNER_S = 'inner_s';
const INNER_T = 'inner_t';
const Z = 'z';

QUnit.test("states with hierarchy", function exec_test(assert) {
  const states = { [OUTER]: { [INNER]: { [INNER_S]: '', [INNER_T]: '' }, [OUTER_A]: '', [OUTER_B]: '' }, [Z]: '' };
  const history = computeHistoryMaps(states);
  assert.deepEqual(history, {
    "stateAncestors": {
      "deep": {
        "INNER": [
          "OUTER"
        ],
        "inner_s": [
          "INNER",
          "OUTER"
        ],
        "inner_t": [
          "INNER",
          "OUTER"
        ],
        "outer_a": [
          "OUTER"
        ],
        "outer_b": [
          "OUTER"
        ]
      },
      "shallow": {
        "INNER": ["OUTER"],
        "inner_s": ["INNER"],
        "inner_t": ["INNER"],
        "outer_a": ["OUTER"],
        "outer_b": ["OUTER"]
      }
    },
    "stateList": [
      "OUTER",
      "INNER",
      "inner_s",
      "inner_t",
      "outer_a",
      "outer_b",
      "z"
    ]
  }, `...`);
});

QUnit.module("Testing analyzeStateTree(states)", {});

QUnit.test("empty states", function exec_test(assert) {
  const states = {};
  const result = analyzeStateTree(states);

  assert.deepEqual(result,
    {
      "statesAdjacencyList": {},
      "statesLeafChildrenList": {}
    }, `...`);
});

QUnit.test("flat states hierarchy", function exec_test(assert) {
  const states = { A: '', B: '', C: '' };
  const result = analyzeStateTree(states);

  assert.deepEqual(result,
    {
      "statesAdjacencyList": {
        "A": [],
        "B": [],
        "C": []
      },
      "statesLeafChildrenList": {
        "A": [],
        "B": [],
        "C": []
      }
    }, `...`);
});

QUnit.test("non-flat states hierarchy", function exec_test(assert) {
  const states = { A: { 'A.1': '', 'A.2': { 'A.2.1': '' }, 'A.3': '' }, B: '', C: { 'C.1': '' } };
  const result = analyzeStateTree(states);

  assert.deepEqual(result,
    {
      "statesAdjacencyList": {
        "A": [
          "A.1",
          "A.2",
          "A.3"
        ],
        "A.1": [],
        "A.2": [
          "A.2.1"
        ],
        "A.2.1": [],
        "A.3": [],
        "B": [],
        "C": [
          "C.1"
        ],
        "C.1": []
      },
      "statesLeafChildrenList": {
        "A": [
          "A.1",
          "A.2.1",
          "A.3"
        ],
        "A.1": [],
        "A.2": [
          "A.2.1"
        ],
        "A.2.1": [],
        "A.3": [],
        "B": [],
        "C": [
          "C.1"
        ],
        "C.1": []
      }
    }, `...`);
});
