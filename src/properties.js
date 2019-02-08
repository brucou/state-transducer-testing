export const HISTORY_STATE_NAME = "H";
export const HISTORY_PREFIX = 'history.'
// CONSTANTS
export const INIT_STATE = 'nok';
export const INIT_EVENT = 'init';
// i.e. State
export const NO_STATE_UPDATE = [];
// NOTE : this really cannot be anything else than a falsy value, beware
export const NO_OUTPUT = null;
export const ACTION_IDENTITY = function ACTION_IDENTITY(){
  return {
    outputs : NO_OUTPUT,
    updates : NO_STATE_UPDATE
  }
}
export const SHALLOW = 'shallow';
export const DEEP = 'deep';
