import { mapOverObj } from "fp-rosetree"
import { NO_OUTPUT, NO_STATE_UPDATE } from "state-transducer";

export const NO_ACTIONS = () => ({ outputs: NO_OUTPUT, updates: NO_STATE_UPDATE });

function isFunction(obj) {
  return typeof obj === 'function'
}

function isPOJO(obj) {
  const proto = Object.prototype;
  const gpo = Object.getPrototypeOf;

  if (obj === null || typeof obj !== "object") {
    return false;
  }
  return gpo(obj) === proto;
}

export function formatResult(result) {
  if (!isPOJO(result)) {
    return result
  }
  else {
    return mapOverObj({
        key: x => x,
        leafValue: prop => isFunction(prop)
          ? (prop.name || prop.displayName || 'anonymous')
          : Array.isArray(prop)
            ? prop.map(formatResult)
            : prop
      },
      result)
  }
}

export function formatMap(mapObj) {
  return Array.from(mapObj.keys()).map(key => ([key, formatFunction(mapObj.get(key))]))
}

export function formatFunction(fn) {
  return fn.name || fn.displayName || 'anonymous'
}

/**
 *
 * @param input
 * @param [generatorState]
 * @returns {function(*, *): {hasGeneratedInput: boolean, input: *, generatorState: *}}
 */
export function constGen(input, generatorState) {
  return function constGen(extS, genS) {
    return { hasGeneratedInput: true, input, generatorState }
  }
}
