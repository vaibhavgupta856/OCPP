/**
 * OCPP 1.6 JSON (OCPP-J) message helpers
 * Message format: [MessageTypeId, ...]
 * 2 = CALL, 3 = CALLRESULT, 4 = CALLERROR
 */

import { v4 as uuidv4 } from 'uuid';

export const MessageType = {
  CALL: 2,
  CALLRESULT: 3,
  CALLERROR: 4,
};

export function createCall(action, payload) {
  const messageId = uuidv4();
  return {
    messageId,
    action,
    payload,
    raw: [MessageType.CALL, messageId, action, payload ?? {}],
  };
}

export function createCallResult(messageId, payload) {
  return [MessageType.CALLRESULT, messageId, payload ?? {}];
}

export function createCallError(messageId, errorCode, errorDescription = '', errorDetails = {}) {
  return [MessageType.CALLERROR, messageId, errorCode, errorDescription, errorDetails];
}

export function parseMessage(data) {
  let parsed;
  try {
    parsed = typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    throw new Error('Invalid JSON frame');
  }
  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new Error('Invalid OCPP-J frame shape');
  }
  const type = parsed[0];
  if (type === MessageType.CALL) {
    return {
      type,
      messageId: parsed[1],
      action: parsed[2],
      payload: parsed[3] ?? {},
    };
  }
  if (type === MessageType.CALLRESULT) {
    return {
      type,
      messageId: parsed[1],
      payload: parsed[2] ?? {},
    };
  }
  if (type === MessageType.CALLERROR) {
    return {
      type,
      messageId: parsed[1],
      errorCode: parsed[2],
      errorDescription: parsed[3] ?? '',
      errorDetails: parsed[4] ?? {},
    };
  }
  throw new Error(`Unknown MessageTypeId: ${type}`);
}

export function stringifyFrame(frame) {
  return JSON.stringify(frame);
}

export function utcNowIso() {
  return new Date().toISOString();
}
