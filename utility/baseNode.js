"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swapKeyValues = exports.nodeJsError = exports.settledPromiseFilled = exports.settledPromiseRejected = void 0;
const settledPromiseRejected = (result) => 'rejected' === result.status;
exports.settledPromiseRejected = settledPromiseRejected;
const settledPromiseFilled = (result) => 'fulfilled' === result.status;
exports.settledPromiseFilled = settledPromiseFilled;
function nodeJsError(testError) {
    return !!testError.code;
}
exports.nodeJsError = nodeJsError;
const swapKeyValues = (obj, numeric) => Object.fromEntries(Object.entries(obj).map(([key, value]) => [value, numeric ? parseInt(key) : key]));
exports.swapKeyValues = swapKeyValues;
