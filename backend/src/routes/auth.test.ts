import { test } from 'node:test'
import assert from 'node:assert'
import { normalizeTelefone } from './auth'

test('normalizeTelefone helper', () => {
  // Test already formatted E.164
  assert.strictEqual(normalizeTelefone('+5551981827578'), '+5551981827578')
  
  // Test formatted with parentheses and hyphens
  assert.strictEqual(normalizeTelefone('(51) 98182-7578'), '+5551981827578')
  
  // Test number with 55 but no + sign
  assert.strictEqual(normalizeTelefone('5551981827578'), '+5551981827578')
  
  // Test local number with DDD but no country code
  assert.strictEqual(normalizeTelefone('51981827578'), '+5551981827578')
  
  // Test short local number (fallback should add country code and default DDD)
  assert.strictEqual(normalizeTelefone('981827578'), '+5555981827578')
})
