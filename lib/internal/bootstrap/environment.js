'use strict';

// This runs necessary preparations to prepare a complete Node.js context
// that depends on run time states.
// It is currently only intended for preparing contexts for embedders.
// 运行必要的代码准备一个完整的nodejs上下文，此上下文依赖于运行时状态
// 此文件仅用于为嵌入程序准备上下文

/* global markBootstrapComplete */
const {
  prepareMainThreadExecution
} = require('internal/bootstrap/pre_execution');

prepareMainThreadExecution();
markBootstrapComplete();
