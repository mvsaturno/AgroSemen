"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const auth_1 = require("./auth");
(0, node_test_1.test)('normalizeTelefone helper', () => {
    // Test already formatted E.164
    node_assert_1.default.strictEqual((0, auth_1.normalizeTelefone)('+5551981827578'), '+5551981827578');
    // Test formatted with parentheses and hyphens
    node_assert_1.default.strictEqual((0, auth_1.normalizeTelefone)('(51) 98182-7578'), '+5551981827578');
    // Test number with 55 but no + sign
    node_assert_1.default.strictEqual((0, auth_1.normalizeTelefone)('5551981827578'), '+5551981827578');
    // Test local number with DDD but no country code
    node_assert_1.default.strictEqual((0, auth_1.normalizeTelefone)('51981827578'), '+5551981827578');
    // Test short local number (fallback should add country code and default DDD)
    node_assert_1.default.strictEqual((0, auth_1.normalizeTelefone)('981827578'), '+5555981827578');
});
//# sourceMappingURL=auth.test.js.map