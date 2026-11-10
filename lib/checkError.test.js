import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECK_TIMEOUT_ERROR, CHECK_UNREADABLE_ERROR, messageFromFailedCheck } from './checkError.js';

test('messageFromFailedCheck keeps a string error from our JSON', () => {
  const body = JSON.stringify({ error: CHECK_TIMEOUT_ERROR });
  assert.equal(messageFromFailedCheck(body), CHECK_TIMEOUT_ERROR);
  assert.equal(messageFromFailedCheck(JSON.stringify({ error: 'Please try again.' })), 'Please try again.');
});

test('messageFromFailedCheck does not render an object error as [object Object]', () => {
  const body = JSON.stringify({ error: { code: 'FUNCTION_INVOCATION_TIMEOUT', message: 'Task timed out' } });
  const message = messageFromFailedCheck(body);
  assert.equal(message, CHECK_UNREADABLE_ERROR);
  assert.equal(message.includes('[object Object]'), false);
  assert.equal(message.includes('FUNCTION_INVOCATION_TIMEOUT'), false);
});

test('messageFromFailedCheck treats a non-JSON body as a friendly timeout', () => {
  const html = '<!DOCTYPE html><html><body><h1>504: FUNCTION_INVOCATION_TIMEOUT</h1></body></html>';
  const message = messageFromFailedCheck(html);
  assert.equal(message, CHECK_UNREADABLE_ERROR);
  assert.equal(message.includes('504'), false);
  assert.equal(messageFromFailedCheck(''), CHECK_UNREADABLE_ERROR);
  assert.equal(messageFromFailedCheck(JSON.stringify({ error: '' })), CHECK_UNREADABLE_ERROR);
  assert.equal(messageFromFailedCheck(JSON.stringify({ error: null })), CHECK_UNREADABLE_ERROR);
});
