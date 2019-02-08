import * as QUnit from "qunitjs"
import { F, merge, T } from "ramda"
import {
  ACTION_IDENTITY, computeTimesCircledOn, DEEP, generateTestSequences, INIT_EVENT, INIT_STATE,
  makeHistoryStates, NO_OUTPUT, SHALLOW
} from "state-transducer"
import { formatResult } from "./helpers"
import { applyPatch } from "json-patch-es6/lib/duplex"
import { ALL_n_TRANSITIONS, ALL_TRANSITIONS } from "graph-adt"

/**
 *
 * @param {FSM_Model} model
 * @param {Operation[]} modelUpdateOperations
 * @returns {FSM_Model}
 */
function applyJSONpatch(model, modelUpdateOperations) {
  // NOTE : we don't validate operations, to avoid throwing errors when for instance the value property for an
  // `add` JSON operation is `undefined` ; and of course we don't mutate the document in place
  return applyPatch(model, modelUpdateOperations, false, false).newDocument;
}

const default_settings = {
  updateState: applyJSONpatch,
};

const a_value = "some value";
const another_value = "another value";
const initialExtendedState = {
  a_key: a_value,
  another_key: another_value
};
const A = 'A';
const B = 'B';
const C = 'C';
const D = 'D';
const E = 'E';
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

QUnit.module("Testing generateTestsFromFSM(fsm, generators, settings)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY
      }
    ],
    initialExtendedState: initialExtendedState
  };
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE, to: 'A', event: INIT_EVENT, gen: function genFn(extendedState) {
          return { input: extendedState, hasGeneratedInput: true }
        }
      }
    ],
  };
  const generators = genFsmDef.transitions;
  const maxNumberOfTraversals = 1;
  const target = 'A';
  const strategy = {
    isTraversableEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      return computeTimesCircledOn(pathTraversalState.path, edge) < (maxNumberOfTraversals || 1)
    },
    isGoalReached: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { getEdgeTarget, getEdgeOrigin } = graph;
      const lastPathVertex = getEdgeTarget(edge);
      // Edge case : accounting for initial vertex
      const vertexOrigin = getEdgeOrigin(edge);

      const isGoalReached = vertexOrigin ? lastPathVertex === target : false;
      return isGoalReached
    },
  };
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults, [
    {
      "controlStateSequence": [
        "nok",
        "A"
      ],
      "inputSequence": [],
      "outputSequence": []
    }
  ], `...`);
});

QUnit.test("INIT event, 2 actions, [F,T] conditions, 2nd action executed", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: 'A', action: ACTION_IDENTITY },
      {
        from: 'A', event: 'ev', guards: [
          { predicate: F, to: 'B', action: ACTION_IDENTITY },
          { predicate: T, to: 'B', action: ACTION_IDENTITY }
        ]
      }
    ],
    initialExtendedState: initialExtendedState
  };
  const genFsmDef = {
    states: { A: '' },
    events: ['ev'],
    transitions: [
      {
        from: INIT_STATE,
        event: INIT_EVENT,
        to: 'A',
        gen: extendedState => ({ input: extendedState, hasGeneratedInput: true })
      },
      {
        from: 'A', event: 'ev', guards: [
          { predicate: F, to: 'B', gen: extendedState => ({ input: null, hasGeneratedInput: false }) },
          {
            predicate: T,
            to: 'B',
            gen: function genFnF(extendedState) {return { input: extendedState, hasGeneratedInput: true }}
          },
        ]
      },
    ],
    initialExtendedState: initialExtendedState
  };
  const generators = genFsmDef.transitions;
  const maxNumberOfTraversals = 1;
  const target = 'B';

  const strategy = {
    isTraversableEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      return computeTimesCircledOn(pathTraversalState.path, edge) < (maxNumberOfTraversals || 1)
    },
    isGoalReached: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { getEdgeTarget, getEdgeOrigin } = graph;
      const lastPathVertex = getEdgeTarget(edge);
      // Edge case : accounting for initial vertex
      const vertexOrigin = getEdgeOrigin(edge);

      const isGoalReached = vertexOrigin ? lastPathVertex === target : false;
      return isGoalReached
    },
  };
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults, [
    {
      "controlStateSequence": [
        "nok",
        "A",
        "B"
      ],
      "inputSequence": [
        {
          "ev": {
            "a_key": "some value",
            "another_key": "another value"
          }
        }
      ],
      "outputSequence": [
        null
      ]
    }
  ], `...`);
});

QUnit.test("INIT event, 2 actions, 2 conditions", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: 'A', action: ACTION_IDENTITY },
      {
        from: 'A', event: 'ev', guards: [
          { predicate: function yes({ branch }) {return branch === 'Y'}, to: 'B', action: ACTION_IDENTITY },
          { predicate: T, to: 'B', action: ACTION_IDENTITY }
        ]
      }
    ],
    initialExtendedState: { branch: 'Y' }
  };
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE,
        event: INIT_EVENT,
        to: 'A',
        gen: extendedState => ({ input: extendedState, hasGeneratedInput: true })
      },
      {
        from: 'A', event: 'ev', guards: [
          {
            predicate: function yes(x) {return x === 'Y'},
            to: 'B',
            gen: extendedState => ({ input: { branch: 'Y' }, hasGeneratedInput: true })
          },
          {
            predicate: T,
            to: 'B',
            gen: function genFnF(extendedState) {return { input: { branch: 'N' }, hasGeneratedInput: true }}
          },
        ]
      }
    ],
  };
  const generators = genFsmDef.transitions;
  const maxNumberOfTraversals = 1;
  const target = 'B';

  const strategy = {
    isTraversableEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      return computeTimesCircledOn(pathTraversalState.path, edge) < (maxNumberOfTraversals || 1)
    },
    isGoalReached: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { getEdgeTarget, getEdgeOrigin } = graph;
      const lastPathVertex = getEdgeTarget(edge);
      // Edge case : accounting for initial vertex
      const vertexOrigin = getEdgeOrigin(edge);

      const isGoalReached = vertexOrigin ? lastPathVertex === target : false;
      return isGoalReached
    },
  };
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults, [
    {
      "controlStateSequence": [
        "nok",
        "A",
        "B"
      ],
      "inputSequence": [
        {
          "ev": {
            "branch": "Y"
          }
        }
      ],
      "outputSequence": [
        null
      ]
    },
    {
      "controlStateSequence": [
        "nok",
        "A",
        "B"
      ],
      "inputSequence": [
        {
          "ev": {
            "branch": "N"
          }
        }
      ],
      "outputSequence": [
        null
      ]
    }
  ], `...`);
});

function setBdata(extendedState, eventData) {
  return {
    updates: [
      { op: 'add', path: '/b', value: eventData }
    ],
    outputs: NO_OUTPUT
  }
}

function setCinvalidData(extendedState, eventData) {
  return {
    updates: [
      { op: 'add', path: '/c', value: { error: eventData.error, data: eventData.data } },
      { op: 'add', path: '/switch', value: false },
    ],
    outputs: NO_OUTPUT
  }
}

function setCvalidData(extendedState, eventData) {
  return {
    updates: [
      { op: 'add', path: '/c', value: { error: null, data: eventData.data } },
      { op: 'add', path: '/switch', value: true },
    ],
    outputs: NO_OUTPUT
  }
}

function setReviewed(extendedState, eventData) {
  return {
    updates: [
      { op: 'add', path: '/reviewed', value: true },
    ],
    outputs: NO_OUTPUT
  }
}

function setReviewedAndOuput(extendedState, eventData) {
  return {
    updates: [
      { op: 'add', path: '/reviewed', value: true },
    ],
    outputs: extendedState
  }
}


const dummyB = { keyB: 'valueB' };
const dummyCv = { valid: true, data: 'valueC' };
const dummyCi = { valid: false, data: 'invalid key for C' };

function setSwitch() {
  return {
    updates: [{ op: 'add', path: '/switch', value: true }],
    outputs: NO_OUTPUT
  }
}

function unsetSwitch() {
  return {
    updates: [{ op: 'add', path: '/switch', value: false }],
    outputs: NO_OUTPUT
  }
}

function incC(extS) {
  const c = extS.c;
  return {
    updates: [{ op: 'add', path: '/c', value: c + 1 }],
    outputs: NO_OUTPUT
  }
}

function incB(extS) {
  const b = extS.b;
  return {
    updates: [{ op: 'add', path: '/b', value: b + 1 }],
    outputs: NO_OUTPUT
  }
}

function outputState(extS) {
  return {
    updates: [],
    outputs: [extS]
  }
}

function isSetSwitch(extS) {
  return extS.switch
}

function isNotSetSwitch(extS) {
  return !extS.switch
}

// NOTE : graph for fsm is in /test/assets
QUnit.test("INIT event multi transitions, self-loop, 1-loop, 2-loops, conditions", function exec_test(assert) {
  const CLICK = 'click';
  const REVIEW_A = 'reviewA';
  const REVIEW_B = 'reviewB';
  const SAVE = 'save';
  const fsmDef = {
    states: { A: '', B: '', C: '', D: '', E: '' },
    events: [CLICK, REVIEW_A, REVIEW_B, SAVE],
    initialExtendedState: { switch: false, reviewed: false },
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY
      },
      {
        from: 'A', event: CLICK, guards: [
          { predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', action: ACTION_IDENTITY },
          { predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', action: ACTION_IDENTITY }
        ]
      },
      { from: 'B', event: CLICK, to: 'C', action: setBdata },
      {
        from: 'C', event: CLICK, guards: [
          { predicate: function isValid(x, e) {return e.valid}, to: 'D', action: setCvalidData },
          { predicate: function isNotValid(x, e) {return !e.valid}, to: 'C', action: setCinvalidData }
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', action: setReviewed },
      { from: 'D', event: REVIEW_B, to: 'B', action: ACTION_IDENTITY },
      { from: 'D', event: SAVE, to: 'E', action: setReviewedAndOuput },
    ],
  };
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          {
            predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', gen: function genINIT2A(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.switch
              }
            }
          },
          {
            predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'B', gen: function genINIT2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.switch
              }
            }
          }
        ]
      },
      {
        from: 'A', event: CLICK, guards: [
          {
            predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', gen: function genA2D(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.reviewed
              }
            }
          },
          {
            predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', gen: function genA2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.reviewed
              }
            }
          }
        ]
      },
      {
        from: 'B',
        event: CLICK,
        to: 'C',
        gen: function genB2C(extS) {return { input: dummyB, hasGeneratedInput: true }}
      },
      {
        from: 'C', event: CLICK, guards: [
          {
            predicate: function isValid(x, e) {return e.valid},
            to: 'D',
            gen: function genC2D(extS) {return { input: dummyCv, hasGeneratedInput: true }}
          },
          {
            predicate: function isNotValid(x, e) {return !e.valid},
            to: 'C',
            gen: function genC2C(extS) {return { input: dummyCi, hasGeneratedInput: true }}
          },
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: REVIEW_B, to: 'B', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: SAVE, to: 'E', gen: extS => ({ input: null, hasGeneratedInput: true }) },
    ],
  };
  const generators = genFsmDef.transitions;
  const strategy = ALL_TRANSITIONS({ targetVertex: 'E' });
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults, [
    {
      "controlStateSequence": [
        "nok",
        "B",
        "C",
        "D",
        "A",
        "D",
        "E"
      ],
      "inputSequence": [
        {
          "click": {
            "keyB": "valueB"
          }
        },
        {
          "click": {
            "data": "valueC",
            "valid": true
          }
        },
        {
          "reviewA": null
        },
        {
          "click": null
        },
        {
          "save": null
        }
      ],
      "outputSequence": [
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": true,
          "switch": true
        }
      ]
    },
    {
      "controlStateSequence": [
        "nok",
        "B",
        "C",
        "D",
        "E"
      ],
      "inputSequence": [
        {
          "click": {
            "keyB": "valueB"
          }
        },
        {
          "click": {
            "data": "valueC",
            "valid": true
          }
        },
        {
          "save": null
        }
      ],
      "outputSequence": [
        NO_OUTPUT,
        NO_OUTPUT,
        {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": false,
          "switch": true
        }
      ]
    },
    {
      "controlStateSequence": [
        "nok",
        "B",
        "C",
        "C",
        "D",
        "A",
        "D",
        "E"
      ],
      "inputSequence": [
        {
          "click": {
            "keyB": "valueB"
          }
        },
        {
          "click": {
            "data": "invalid key for C",
            "valid": false
          }
        },
        {
          "click": {
            "data": "valueC",
            "valid": true
          }
        },
        {
          "reviewA": null
        },
        {
          "click": null
        },
        {
          "save": null
        }
      ],
      "outputSequence": [
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": true,
          "switch": true
        }
      ]
    },
    {
      "controlStateSequence": [
        "nok",
        "B",
        "C",
        "C",
        "D",
        "E"
      ],
      "inputSequence": [
        {
          "click": {
            "keyB": "valueB"
          }
        },
        {
          "click": {
            "data": "invalid key for C",
            "valid": false
          }
        },
        {
          "click": {
            "data": "valueC",
            "valid": true
          }
        },
        {
          "save": null
        }
      ],
      "outputSequence": [
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": false,
          "switch": true
        }
      ]
    }
  ], `...`);
});

QUnit.test("INIT event multi transitions, self-loop, 1-loop, 2-loops, conditions, 2 cycles allowed", function exec_test(assert) {
  const CLICK = 'click';
  const REVIEW_A = 'reviewA';
  const REVIEW_B = 'reviewB';
  const SAVE = 'save';
  const fsmDef = {
    states: { A: '', B: '', C: '', D: '', E: '' },
    events: [CLICK, REVIEW_A, REVIEW_B, SAVE],
    initialExtendedState: { switch: true, reviewed: false },
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, to: 'A', action: ACTION_IDENTITY,
      },
      {
        from: 'A', event: CLICK, guards: [
          { predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', action: ACTION_IDENTITY },
          { predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', action: ACTION_IDENTITY }
        ]
      },
      { from: 'B', event: CLICK, to: 'C', action: setBdata },
      {
        from: 'C', event: CLICK, guards: [
          { predicate: function isValid(x, e) {return e.valid}, to: 'D', action: setCvalidData },
          { predicate: function isNotValid(x, e) {return !e.valid}, to: 'C', action: setCinvalidData }
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', action: setReviewed },
      { from: 'D', event: REVIEW_B, to: 'B', action: ACTION_IDENTITY },
      { from: 'D', event: SAVE, to: 'E', action: setReviewedAndOuput },
    ],
  };
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          {
            predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', gen: function genINIT2A(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.switch
              }
            }
          },
          {
            predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'B', gen: function genINIT2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.switch
              }
            }
          }
        ]
      },
      {
        from: 'A', event: CLICK, guards: [
          {
            predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', gen: function genA2D(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.reviewed
              }
            }
          },
          {
            predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', gen: function genA2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.reviewed
              }
            }
          }
        ]
      },
      {
        from: 'B',
        event: CLICK,
        to: 'C',
        gen: function genB2C(extS) {return { input: dummyB, hasGeneratedInput: true }}
      },
      {
        from: 'C', event: CLICK, guards: [
          {
            predicate: function isValid(x, e) {return e.valid},
            to: 'D',
            gen: function genC2D(extS) {return { input: dummyCv, hasGeneratedInput: true }}
          },
          {
            predicate: function isNotValid(x, e) {return !e.valid},
            to: 'C',
            gen: function genC2C(extS) {return { input: dummyCi, hasGeneratedInput: true }}
          },
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: REVIEW_B, to: 'B', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: SAVE, to: 'E', gen: extS => ({ input: null, hasGeneratedInput: true }) },
    ],
  };
  const generators = genFsmDef.transitions;
  const strategy = ALL_n_TRANSITIONS({ targetVertex: 'E', maxNumberOfTraversals: 2 });
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults.map(x => x.controlStateSequence), [
    ["nok", "A", "B", "C", "D", "A", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "A", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "A", "D", "B", "C", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "A", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "B", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "A", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "A", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "B", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "E"]
  ], `...`);
});

// NOTE : this is a state machine with the same semantics as the first test, only that we have extra compound state
QUnit.test("INIT event multi transitions, self-loop, 1-loop, 2-loops, conditions, inner INIT event transitions", function exec_test(assert) {
  const CLICK = 'click';
  const REVIEW_A = 'reviewA';
  const REVIEW_B = 'reviewB';
  const SAVE = 'save';
  const fsmDef = {
    states: { A: '', B: '', C: '', OUTER_GROUP_D: { INNER_GROUP_D: { D: '' }, E: '' } },
    events: [CLICK, REVIEW_A, REVIEW_B, SAVE],
    initialExtendedState: { switch: false, reviewed: false },
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY
      },
      {
        from: 'A', event: CLICK, guards: [
          { predicate: function isReviewed(x, e) {return x.reviewed}, to: 'OUTER_GROUP_D', action: ACTION_IDENTITY },
          { predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', action: ACTION_IDENTITY }
        ]
      },
      { from: 'B', event: CLICK, to: 'C', action: setBdata },
      {
        from: 'C', event: CLICK, guards: [
          { predicate: function isValid(x, e) {return e.valid}, to: 'INNER_GROUP_D', action: setCvalidData },
          { predicate: function isNotValid(x, e) {return !e.valid}, to: 'C', action: setCinvalidData }
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', action: setReviewed },
      { from: 'D', event: REVIEW_B, to: 'B', action: ACTION_IDENTITY },
      { from: 'D', event: SAVE, to: 'E', action: setReviewedAndOuput },
      { from: 'OUTER_GROUP_D', event: INIT_EVENT, to: 'INNER_GROUP_D', action: ACTION_IDENTITY },
      { from: 'INNER_GROUP_D', event: INIT_EVENT, to: 'D', action: ACTION_IDENTITY },
    ],
  };
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          {
            predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', gen: function genINIT2A(extS) {
              return {
                input: extS, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.switch
              }
            }
          },
          {
            predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'B', gen: function genINIT2B(extS) {
              return {
                input: extS, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.switch
              }
            }
          }
        ]
      },
      {
        from: 'A', event: CLICK, guards: [
          {
            predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', gen: function genA2D(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.reviewed
              }
            }
          },
          {
            predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', gen: function genA2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.reviewed
              }
            }
          }
        ]
      },
      {
        from: 'B',
        event: CLICK,
        to: 'C',
        gen: function genB2C(extS) {return { input: dummyB, hasGeneratedInput: true }}
      },
      {
        from: 'C', event: CLICK, guards: [
          {
            predicate: function isValid(x, e) {return e.valid},
            to: 'INNER_GROUP_D',
            gen: function genC2D(extS) {return { input: dummyCv, hasGeneratedInput: true }}
          },
          {
            predicate: function isNotValid(x, e) {return !e.valid},
            to: 'C',
            gen: function genC2C(extS) {return { input: dummyCi, hasGeneratedInput: true }}
          },
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: REVIEW_B, to: 'B', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: SAVE, to: 'E', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      // No need for input generators on automatic events (except at machine start time)
      { from: 'OUTER_GROUP_D', event: INIT_EVENT, to: 'INNER_GROUP_D' },
      { from: 'INNER_GROUP_D', event: INIT_EVENT, to: 'D' },
    ],
  };
  const generators = genFsmDef.transitions;
  const strategy = ALL_TRANSITIONS({ targetVertex: 'E' });
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults.map(x => x.controlStateSequence), [
    ["nok", "B", "C", "INNER_GROUP_D", "D", "A", "OUTER_GROUP_D", "INNER_GROUP_D", "D", "E"],
    ["nok", "B", "C", "INNER_GROUP_D", "D", "E"],
    ["nok", "B", "C", "C", "INNER_GROUP_D", "D", "A", "OUTER_GROUP_D", "INNER_GROUP_D", "D", "E"],
    ["nok", "B", "C", "C", "INNER_GROUP_D", "D", "E"]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.inputSequence), [
    [
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "valueC", "valid": true } },
      { "reviewA": null },
      { "click": null },
      { "save": null }
    ],
    [
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "valueC", "valid": true } },
      { "save": null }],
    [
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "invalid key for C", "valid": false } },
      { "click": { "data": "valueC", "valid": true } },
      { "reviewA": null },
      { "click": null },
      { "save": null }
    ],
    [
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "invalid key for C", "valid": false } },
      { "click": { "data": "valueC", "valid": true } },
      { "save": null }
    ]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.outputSequence), [
    [
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": true,
      "switch": true
    }
    ],
    [
      NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": false,
      "switch": true
    }
    ],
    [
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": true,
      "switch": true
    }
    ],
    [
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": false,
      "switch": true
    }
    ]
  ], `...`);
});

// NOTE : this is a state machine with the same semantics as the first test, only that we have extra eventless
// transition
QUnit.test("eventless transitions no guards, inner INIT event transitions, loops", function exec_test(assert) {
  const CLICK = 'click';
  const REVIEW_A = 'reviewA';
  const REVIEW_B = 'reviewB';
  const SAVE = 'save';
  const fsmDef = {
    states: { START:'', EVENTLESS: '', A: '', B: '', C: '', OUTER_GROUP_D: { INNER_GROUP_D: { D: '' } }, E: '' },
    events: [CLICK, REVIEW_A, REVIEW_B, SAVE, 'start'],
    initialExtendedState: { switch: false, reviewed: false },
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, to: 'START', action: ACTION_IDENTITY
      },
      {
        from: 'START', event: 'start', to: 'EVENTLESS', action: ACTION_IDENTITY
      },
      {
        from: 'A', event: CLICK, guards: [
          { predicate: function isReviewed(x, e) {return x.reviewed}, to: 'OUTER_GROUP_D', action: ACTION_IDENTITY },
          { predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', action: ACTION_IDENTITY }
        ]
      },
      { from: 'EVENTLESS', to: 'B', action: ACTION_IDENTITY },
      { from: 'B', event: CLICK, to: 'C', action: setBdata },
      {
        from: 'C', event: CLICK, guards: [
          { predicate: function isValid(x, e) {return e.valid}, to: 'INNER_GROUP_D', action: setCvalidData },
          { predicate: function isNotValid(x, e) {return !e.valid}, to: 'C', action: setCinvalidData }
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', action: setReviewed },
      { from: 'D', event: REVIEW_B, to: 'B', action: ACTION_IDENTITY },
      { from: 'D', event: SAVE, to: 'E', action: setReviewedAndOuput },
      { from: 'OUTER_GROUP_D', event: INIT_EVENT, to: 'INNER_GROUP_D', action: ACTION_IDENTITY },
      { from: 'INNER_GROUP_D', event: INIT_EVENT, to: 'D', action: ACTION_IDENTITY },
    ],
  };
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, to: 'START', gen: function genINIT2B(extS) {
          return {
            input: null,
            hasGeneratedInput: true
          }
        }
      },
      {
        from: 'START', event: 'start', to: 'EVENTLESS', gen: function genINIT2B(extS) {
          return {
            input: null,
            hasGeneratedInput: !extS.switch
          }
        }
      },
      {
        from: 'A', event: CLICK, guards: [
          {
            predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', gen: function genA2D(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.reviewed
              }
            }
          },
          {
            predicate: function isNotReviewed(x, e) {return !x.reviewed},
            to: 'EVENTLESS',
            gen: function genA2eventLess(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.reviewed
              }
            }
          }
        ]
      },
      { from: 'EVENTLESS', to: 'B' },
      {
        from: 'B',
        event: CLICK,
        to: 'C',
        gen: function genB2C(extS) {return { input: dummyB, hasGeneratedInput: true }}
      },
      {
        from: 'C', event: CLICK, guards: [
          {
            predicate: function isValid(x, e) {return e.valid},
            to: 'INNER_GROUP_D',
            gen: function genC2D(extS) {return { input: dummyCv, hasGeneratedInput: true }}
          },
          {
            predicate: function isNotValid(x, e) {return !e.valid},
            to: 'C',
            gen: function genC2C(extS) {return { input: dummyCi, hasGeneratedInput: true }}
          },
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: REVIEW_B, to: 'B', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: SAVE, to: 'E', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      // No need for input generators on automatic events (except at machine start time)
      { from: 'OUTER_GROUP_D', event: INIT_EVENT, to: 'INNER_GROUP_D' },
      { from: 'INNER_GROUP_D', event: INIT_EVENT, to: 'D' },
    ],
  };
  const generators = genFsmDef.transitions;
  const strategy = ALL_TRANSITIONS({ targetVertex: 'E' });
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults.map(x => x.controlStateSequence), [
    ["nok", "START","EVENTLESS", "B", "C", "INNER_GROUP_D", "D", "A", "OUTER_GROUP_D", "INNER_GROUP_D", "D", "E"],
    ["nok", "START","EVENTLESS", "B", "C", "INNER_GROUP_D", "D", "E"],
    ["nok", "START","EVENTLESS", "B", "C", "C", "INNER_GROUP_D", "D", "A", "OUTER_GROUP_D", "INNER_GROUP_D", "D", "E"],
    ["nok", "START","EVENTLESS", "B", "C", "C", "INNER_GROUP_D", "D", "E"]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.inputSequence), [
    [
      { "start": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "valueC", "valid": true } },
      { "reviewA": null },
      { "click": null },
      { "save": null }
    ],
    [
      { "start": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "valueC", "valid": true } },
      { "save": null }],
    [
      { "start": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "invalid key for C", "valid": false } },
      { "click": { "data": "valueC", "valid": true } },
      { "reviewA": null },
      { "click": null },
      { "save": null }
    ],
    [
      { "start": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "invalid key for C", "valid": false } },
      { "click": { "data": "valueC", "valid": true } },
      { "save": null }
    ]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.outputSequence), [
    [
      null,
      null,
      null,
      null,
      null,
      null,
      {
        "b": {
          "keyB": "valueB"
        },
        "c": {
          "data": "valueC",
          "error": null
        },
        "reviewed": true,
        "switch": true
      }
    ],
    [
      null,
      null,
      null,
      null,
      {
        "b": {
          "keyB": "valueB"
        },
        "c": {
          "data": "valueC",
          "error": null
        },
        "reviewed": false,
        "switch": true
      }
    ],
    [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      {
        "b": {
          "keyB": "valueB"
        },
        "c": {
          "data": "valueC",
          "error": null
        },
        "reviewed": true,
        "switch": true
      }
    ],
    [
      null,
      null,
      null,
      null,
      null,
      {
        "b": {
          "keyB": "valueB"
        },
        "c": {
          "data": "valueC",
          "error": null
        },
        "reviewed": false,
        "switch": true
      }
    ]
  ], `...`);
});

QUnit.test("shallow history transitions, INIT event CASCADING transitions", function exec_test(assert) {
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
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE,
        event: INIT_EVENT,
        to: OUTER,
        gen: function genINITtoOUTER(extS) {return { input: extS, hasGeneratedInput: true }}
      },
      { from: OUTER, event: INIT_EVENT, to: OUTER_A },
      {
        from: OUTER_A,
        event: EVENT1,
        to: INNER,
        gen: function genOUTER_AtoINNER(extS) {return { input: null, hasGeneratedInput: true }}
      },
      { from: INNER, event: INIT_EVENT, to: INNER_S },
      {
        from: INNER_S,
        event: EVENT3,
        to: INNER_T,
        gen: function genINNER_StoINNER_T(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: INNER_T,
        event: EVENT3,
        to: INNER_S,
        gen: function genINNER_TtoINNER_S(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: INNER,
        event: EVENT2,
        to: OUTER_B,
        gen: function genINNERtoOUTER_B(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: OUTER,
        event: EVENT5,
        to: Z,
        gen: function genOUTERtoZ(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: Z, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs(DEEP, OUTER),
            gen: function genZtoOUTER_DEEP_H(extS) {return { input: DEEP, hasGeneratedInput: extS.history === DEEP }},
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs(SHALLOW, OUTER),
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
  const generators = genFsmDef.transitions;
  const strategy = ALL_TRANSITIONS({ targetVertex: OUTER_B });
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults.map(x => x.controlStateSequence), [
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "z", "INNER", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "z", "INNER", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "z", "INNER", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "z", "INNER", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "inner_t", "inner_s", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "inner_t", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "outer_b"]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.inputSequence), [
    [
      { "event1": null }, { "event3": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event3": null }, { "event3": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }],
    [
      { "event1": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }
    ],
    [
      { "event1": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event3": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event3": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event3": null }, { "event3": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event3": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event3": null }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }
    ]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.outputSequence), [
    [null, null, null, null],
    [null, null, null, null, 0, null],
    [null, null, null],
    [null, null, null, 0, null],
    [null, null],
    [null, null, 0, null, null, null],
    [null, null, 0, null, null],
    [null, null, 0, null],
    [null, 0, null, null, null, null],
    [null, 0, null, null, null, null, 1, null],
    [null, 0, null, null, null],
    [null, 0, null, null, null, 1, null],
    [null, 0, null, null],
    [null, 0, null, null, 1, null, null, null],
    [null, 0, null, null, 1, null, null],
    [null, 0, null, null, 1, null]
  ], `...`);
});

QUnit.test("deep history transitions, INIT event CASCADING transitions", function exec_test(assert) {
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
            to: hs(DEEP, OUTER),
            gen: function genZtoOUTER_DEEP_H(extS) {return { input: DEEP, hasGeneratedInput: extS.history === DEEP }},
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs(SHALLOW, OUTER),
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
  const generators = genFsmDef.transitions;
  const strategy = ALL_TRANSITIONS({ targetVertex: OUTER_B });
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults.map(x => x.controlStateSequence), [
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
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.inputSequence), [
    [
      { "event1": null }, { "event3": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event3": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }
    ],
    [
      { "event1": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }
    ],
    [      { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{ "event1": null }, { "event2": null }],
    [{ "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event3": null }, { "event2": null }],
    [{ "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }],
    [{ "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }],
    [{ "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{ "event1": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event3": null }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event3": null }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event3": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }],
    [{ "event5": null }, { "event4": "deep" }, { "event1": null }, { "event5": null }, { "event4": "deep" }, { "event2": null }]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.outputSequence), [
    [null, null, null, null],
    [null, null, null, null, 0, null],
    [null, null, null],
    [null, null, null, 0, null, null],
    [null, null, null, 0, null, null, 1, null],
    [null, null, null, 0, null],
    [null, null],
    [null, null, 0, null, null, null],
    [null, null, 0, null, null],
    [null, null, 0, null, null, 1, null, null],
    [null, null, 0, null, null, 1, null],
    [null, null, 0, null],
    [null, 0, null, null, null, null],
    [null, 0, null, null, null, null, 1, null],
    [null, 0, null, null, null],
    [null, 0, null, null, null, 1, null, null],
    [null, 0, null, null, null, 1, null, null, 2, null],
    [null, 0, null, null, null, 1, null],
    [null, 0, null, null],
    [null, 0, null, null, 1, null, null, null],
    [null, 0, null, null, 1, null, null],
    [null, 0, null, null, 1, null, null, 2, null, null],
    [null, 0, null, null, 1, null, null, 2, null],
    [null, 0, null, null, 1, null]
  ], `...`);
});

QUnit.test("shallow history transitions, INIT event CASCADING transitions, compound to compound case", function exec_test(assert) {
  const OUTER = 'OUTER';
  const INNER = 'INNER';
  const OTHER = 'OTHER';
  const OUTER_A = 'outer_a';
  const OUTER_B = 'outer_b';
  const INNER_S = 'inner_s';
  const INNER_T = 'inner_t';
  const Z = 'z';
  const states = {
    [OUTER]: {
      [INNER]: { [INNER_S]: '', [INNER_T]: '' },
      [OUTER_A]: '',
      [OTHER]: { [OUTER_B]: '' }
    },
    [Z]: ''
  };
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
      { from: INNER, event: EVENT2, to: OTHER, action: ACTION_IDENTITY },
      { from: OTHER, event: INIT_EVENT, to: OUTER_B, action: ACTION_IDENTITY },
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
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE,
        event: INIT_EVENT,
        to: OUTER,
        gen: function genINITtoOUTER(extS) {return { input: extS, hasGeneratedInput: true }}
      },
      { from: OUTER, event: INIT_EVENT, to: OUTER_A },
      {
        from: OUTER_A,
        event: EVENT1,
        to: INNER,
        gen: function genOUTER_AtoINNER(extS) {return { input: null, hasGeneratedInput: true }}
      },
      { from: INNER, event: INIT_EVENT, to: INNER_S },
      {
        from: INNER_S,
        event: EVENT3,
        to: INNER_T,
        gen: function genINNER_StoINNER_T(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: INNER_T,
        event: EVENT3,
        to: INNER_S,
        gen: function genINNER_TtoINNER_S(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: INNER,
        event: EVENT2,
        to: OTHER,
        gen: function genINNERtoOUTER_B(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: OUTER,
        event: EVENT5,
        to: Z,
        gen: function genOUTERtoZ(extS) {return { input: null, hasGeneratedInput: true }}
      },
      {
        from: Z, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs(DEEP, OUTER),
            gen: function genZtoOUTER_DEEP_H(extS) {return { input: DEEP, hasGeneratedInput: extS.history === DEEP }},
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs(SHALLOW, OUTER),
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
  const generators = genFsmDef.transitions;
  const strategy = ALL_TRANSITIONS({ targetVertex: OUTER_B });
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults.map(x => x.controlStateSequence), [
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "z", "INNER", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "inner_t", "z", "INNER", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "inner_t", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "inner_t", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "inner_s", "z", "INNER", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "inner_t", "z", "INNER", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "inner_t", "inner_s", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "inner_t", "OTHER", "outer_b"],
    ["nok", "OUTER", "outer_a", "z", "outer_a", "INNER", "inner_s", "z", "INNER", "inner_s", "OTHER", "outer_b"]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.inputSequence), [
    [
      { "event1": null }, { "event3": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event3": null }, { "event3": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }],
    [
      { "event1": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }
    ],
    [
      { "event1": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event3": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event3": null }, { "event2": null }
    ],
    [
      { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event3": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event3": null }, { "event3": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event3": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event3": null }, { "event3": null }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event3": null }, { "event2": null }
    ],
    [
      { "event5": null }, { "event4": "shallow" }, { "event1": null }, { "event5": null }, { "event4": "shallow" }, { "event2": null }
    ]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.outputSequence), [
    [null, null, null, null],
    [null, null, null, null, 0, null],
    [null, null, null],
    [null, null, null, 0, null],
    [null, null],
    [null, null, 0, null, null, null],
    [null, null, 0, null, null],
    [null, null, 0, null],
    [null, 0, null, null, null, null],
    [null, 0, null, null, null, null, 1, null],
    [null, 0, null, null, null],
    [null, 0, null, null, null, 1, null],
    [null, 0, null, null],
    [null, 0, null, null, 1, null, null, null],
    [null, 0, null, null, 1, null, null],
    [null, 0, null, null, 1, null]
  ], `...`);
});

QUnit.test("eventless x atomic transitions", function exec_test(assert) {
  const states = { [A]: '', [B]: '', [C]: '', [D]: '', [E]: '', 'START':'' };
  const fsmDef = {
    states,
    events: [EVENT1, EVENT2, 'start'],
    initialExtendedState: { switch: false, b: 0, c: 0 },
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: 'START', action: ACTION_IDENTITY },
      { from: 'START', event: 'start', to: A, action: setSwitch },
      {
        from: A, guards: [
          { predicate: isSetSwitch, to: C, action: incC },
          { predicate: isNotSetSwitch, to: B, action: incB },
        ]
      },
      { from: C, event: EVENT1, to: D, action: ACTION_IDENTITY },
      { from: B, event: EVENT2, to: D, action: ACTION_IDENTITY },
      {
        from: D, guards: [
          { predicate: isSetSwitch, to: A, action: unsetSwitch },
          { predicate: isNotSetSwitch, to: E, action: outputState },
        ]
      },
    ],
  };
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE,
        event: INIT_EVENT,
        to: 'START',
        gen: function genINITtoA(extS) {return { input: extS, hasGeneratedInput: true } }
      },
      { from: 'START', event: 'start', to: A, gen: function (extS) {return { input: extS, hasGeneratedInput: true } } },
      {
        from: A, guards: [
          { predicate: isSetSwitch, to: C },
          { predicate: isNotSetSwitch, to: B },
        ]
      },
      { from: C, event: EVENT1, to: D, gen: function genCtoD(extS) {return { input: null, hasGeneratedInput: true } } },
      { from: B, event: EVENT2, to: D, gen: function genBtoD(extS) {return { input: null, hasGeneratedInput: true } } },
      {
        from: D, guards: [
          { predicate: isSetSwitch, to: A },
          { predicate: isNotSetSwitch, to: E },
        ]
      },
    ],
  };
  const generators = genFsmDef.transitions;
  const strategy = ALL_TRANSITIONS({ targetVertex: 'E' });
  const settings = merge(default_settings, { strategy });
  const results = generateTestSequences(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults.map(x => x.controlStateSequence), [
    ["nok", "START", "A", "C", "D", "A", "B", "D", "E"]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.inputSequence), [
    [
      { "start": { "b": 0, "c": 0, "switch": false } },
      { "event1": null },
      { "event2": null }
    ]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.outputSequence), [
    [
      null,
      null,
      null,
      null,
      null,
      null,
      {
        "b": 1,
        "c": 1,
        "switch": false
      }
    ]
  ], `...`);
});
