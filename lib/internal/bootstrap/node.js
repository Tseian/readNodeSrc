// Hello, and welcome to hacking node.js!
//
// This file is invoked by `node::RunBootstrapping()` in `src/node.cc`,
// and is responsible for setting up node.js core before executing main scripts
// under `lib/internal/main/`.
// This file is currently run to bootstrap both the main thread and the worker
// threads.
// sSome setups are conditional, controlled with isMainThread and
// ownsProcessState.
// This file is expected not to perform any asynchronous operations itself
// when being executed - those should be done in either
// `lib/internal/bootstrap/pre_execution.js` or in main scripts. The majority
// of the code here focus on setting up the global proxy and the process
// object in a synchronous manner.
// As special caution is given to the performance of the startup process,
// many dependencies are invoked lazily.
//
// Scripts run before this file:
// - `lib/internal/per_context/primordials.js`: to save copies of JavaScript
//   builtins that won't be affected by user land monkey-patching for internal
//   modules to use.
// - `lib/internal/bootstrap/loaders.js`: to setup internal binding and
//   module loaders, including `process.binding()`, `process._linkedBinding()`,
//   `internalBinding()` and `NativeModule`.
//
// After this file is run, one of the main scripts under `lib/internal/main/`
// will be selected by C++ to start the actual execution. The main scripts may
// run additional setups exported by `lib/internal/bootstrap/pre_execution.js`,
// depending on the execution mode.

// 这个文件将由src/node.cc中node::RunBootstrapping()调用
// 负责在执行在lib/internal/main/这个文件夹中主要脚本之前配置nodejs核心
// 这个文件被运行用以引导main 线程和worker线程
// 有一些设置是有条件的，有isMainThread和ownsProcessState这两个条件控制
// 这个文件不应该执行任何异步的操作
// 当被执行时候，应该在lib/internal/bootstrap/pre_execution.js 或者 在主逻辑脚本
// 这里大部分代码都是在已同步的方式设置全局代理和process对象
// 犹豫需要特别注意启动过程的性能，因此许多依赖都要惰性加载
// 以下代码会在执行此文件前执行
// - lib/internal/per_context/primordials.js：
// 保存那些不受用户monkey(灵活？)补丁影响的js内置模块，提供给内部模块使用
// - `lib/internal/bootstrap/loaders.js`：
// 设置内置binding和模块loader，包括`process.binding()`, `process._linkedBinding()`,
//   `internalBinding()` and `NativeModule`.
// 这个文件执行后，在`lib/internal/main/`文件下面的一个主脚本将被c++选中用以开始实际运行
// 根据执行模式，主要脚本可能会有额外的设置，这些设置从lib/internal/bootstrap/pre_execution.js中导出

'use strict';

// This file is compiled as if it's wrapped in a function with arguments
// passed by node::RunBootstrapping()
// 这个文件被编译，通过node::RunBootstrapping()函数被包装成一个居右参数的函数 参数如下：
/* global process, require, internalBinding, isMainThread, ownsProcessState */
// internalBinding，require来自loader.js
setupPrepareStackTrace();

const { JSON, Object, Symbol } = primordials;
const config = internalBinding('config');
const { deprecate } = require('internal/util');

setupProcessObject();

setupGlobalProxy();
setupBuffer();

process.domain = null;
process._exiting = false;

// Bootstrappers for all threads, including worker threads and main thread
const perThreadSetup = require('internal/process/per_thread');
// Bootstrappers for the main thread only
let mainThreadSetup;
// Bootstrappers for the worker threads only
let workerThreadSetup;
if (ownsProcessState) {
  mainThreadSetup = require(
    'internal/process/main_thread_only'
  );
} else {
  workerThreadSetup = require(
    'internal/process/worker_thread_only'
  );
}

// process.config is serialized config.gypi
process.config = JSON.parse(internalBinding('native_module').config);

// Process的方法原型来自内建模块 process_methods
const rawMethods = internalBinding('process_methods');
// Set up methods and events on the process object for the main thread
if (isMainThread) { // 主进程设置
  // abort方法会使 Node.js 进程立即结束，并生成一个核心文件
  process.abort = rawMethods.abort;
  // 通过mainThreadSetup.wrapProcessMethods这个方法给process绑定方法
  const wrapped = mainThreadSetup.wrapProcessMethods(rawMethods);
  // 文件权限掩码，从父进程处继承     文件权限基数 666 - 文件掩码 = 文件权限；
  // 文件目录权限基数 777 - 文件目录掩码值 = 文件目录权限值
  // 例如 666 - 644 = 022 即权限为 rw-r-r 当前用户可读可写，当前用户组组员和其他用户只有读的权限
  process.umask = wrapped.umask;
  process.chdir = wrapped.chdir;
  process.cwd = wrapped.cwd;

  // TODO(joyeecheung): deprecate and remove these underscore methods
  process._debugProcess = rawMethods._debugProcess;
  process._debugEnd = rawMethods._debugEnd;
  process._startProfilerIdleNotifier =
    rawMethods._startProfilerIdleNotifier;
  process._stopProfilerIdleNotifier = rawMethods._stopProfilerIdleNotifier;
} else { // worker进程
  const wrapped = workerThreadSetup.wrapProcessMethods(rawMethods);

  process.abort = workerThreadSetup.unavailable('process.abort()');
  process.chdir = workerThreadSetup.unavailable('process.chdir()');
  process.umask = wrapped.umask;
  process.cwd = rawMethods.cwd;
}

// Set up methods on the process object for all threads
// 设置process对象所有通用的方法 没有经过包装的方法
{
  process.dlopen = rawMethods.dlopen;
  process.uptime = rawMethods.uptime;

  // TODO(joyeecheung): either remove them or make them public
  process._getActiveRequests = rawMethods._getActiveRequests;
  process._getActiveHandles = rawMethods._getActiveHandles;

  // TODO(joyeecheung): remove these
  process.reallyExit = rawMethods.reallyExit;
  process._kill = rawMethods._kill;

  const wrapped = perThreadSetup.wrapProcessMethods(rawMethods);
  process._rawDebug = wrapped._rawDebug;
  process.hrtime = wrapped.hrtime;
  process.hrtime.bigint = wrapped.hrtimeBigInt;
  process.cpuUsage = wrapped.cpuUsage;
  process.resourceUsage = wrapped.resourceUsage;
  process.memoryUsage = wrapped.memoryUsage;
  process.kill = wrapped.kill;
  process.exit = wrapped.exit;
}

const credentials = internalBinding('credentials');
if (credentials.implementsPosixCredentials) {
  process.getuid = credentials.getuid;
  process.geteuid = credentials.geteuid;
  process.getgid = credentials.getgid;
  process.getegid = credentials.getegid;
  process.getgroups = credentials.getgroups;

  if (ownsProcessState) {
    const wrapped = mainThreadSetup.wrapPosixCredentialSetters(credentials);
    process.initgroups = wrapped.initgroups;
    process.setgroups = wrapped.setgroups;
    process.setegid = wrapped.setegid;
    process.seteuid = wrapped.seteuid;
    process.setgid = wrapped.setgid;
    process.setuid = wrapped.setuid;
  } else {
    process.initgroups =
      workerThreadSetup.unavailable('process.initgroups()');
    process.setgroups = workerThreadSetup.unavailable('process.setgroups()');
    process.setegid = workerThreadSetup.unavailable('process.setegid()');
    process.seteuid = workerThreadSetup.unavailable('process.seteuid()');
    process.setgid = workerThreadSetup.unavailable('process.setgid()');
    process.setuid = workerThreadSetup.unavailable('process.setuid()');
  }
}

if (isMainThread) {
  const { getStdout, getStdin, getStderr } =
    require('internal/process/stdio').getMainThreadStdio();
  setupProcessStdio(getStdout, getStdin, getStderr);
} else {
  const { getStdout, getStdin, getStderr } =
    workerThreadSetup.createStdioGetters();
  setupProcessStdio(getStdout, getStdin, getStderr);
}

// Setup the callbacks that node::AsyncWrap will call when there are hooks to
// process. They use the same functions as the JS embedder API. These callbacks
// are setup immediately to prevent async_wrap.setupHooks() from being hijacked
// and the cost of doing so is negligible.
// 设置node :: AsyncWrap在有钩子要处理时将调用的回调。 它们使用与JS embedder API相同的功能。
// 立即设置这些回调，以防止async_wrap.setupHooks（）被劫持，并且这样做的成本可以忽略不计。

const { nativeHooks } = require('internal/async_hooks');
// 包装钩子函数
internalBinding('async_wrap').setupHooks(nativeHooks);

const {
  setupTaskQueue,
  queueMicrotask
} = require('internal/process/task_queues');

if (!config.noBrowserGlobals) {
  // Override global console from the one provided by the VM
  // to the one implemented by Node.js
  // https://console.spec.whatwg.org/#console-namespace
  // 用nodejs实现的console覆盖原本的全局console对象
  exposeNamespace(global, 'console', createGlobalConsole(global.console));

  const { URL, URLSearchParams } = require('internal/url');
  // 暴露URL，URLSearchParams两个接口
  // https://url.spec.whatwg.org/#url
  exposeInterface(global, 'URL', URL);
  // https://url.spec.whatwg.org/#urlsearchparams
  exposeInterface(global, 'URLSearchParams', URLSearchParams);

  const {
    TextEncoder, TextDecoder
  } = require('internal/encoding');
  // https://encoding.spec.whatwg.org/#textencoder
  exposeInterface(global, 'TextEncoder', TextEncoder);
  // https://encoding.spec.whatwg.org/#textdecoder
  exposeInterface(global, 'TextDecoder', TextDecoder);

  // https://html.spec.whatwg.org/multipage/webappapis.html#windoworworkerglobalscope
  const timers = require('timers');
  defineOperation(global, 'clearInterval', timers.clearInterval);
  defineOperation(global, 'clearTimeout', timers.clearTimeout);
  defineOperation(global, 'setInterval', timers.setInterval);
  defineOperation(global, 'setTimeout', timers.setTimeout);

  defineOperation(global, 'queueMicrotask', queueMicrotask);

  // Non-standard extensions:
  defineOperation(global, 'clearImmediate', timers.clearImmediate);
  defineOperation(global, 'setImmediate', timers.setImmediate);
}

// Set the per-Environment callback that will be called
// when the TrackingTraceStateObserver updates trace state.
// Note that when NODE_USE_V8_PLATFORM is true, the observer is
// attached to the per-process TracingController.
// 设置每个环境回调，当TrackingTraceStateObserver更新跟踪状态时将调用该回调。
// 请注意，当NODE_USE_V8_PLATFORM为true时，观察者将附加到每个进程的TracingController。
const { setTraceCategoryStateUpdateHandler } = internalBinding('trace_events');
setTraceCategoryStateUpdateHandler(perThreadSetup.toggleTraceCategoryState);

// process.allowedNodeEnvironmentFlags
Object.defineProperty(process, 'allowedNodeEnvironmentFlags', {
  get() {
    const flags = perThreadSetup.buildAllowedFlags();
    process.allowedNodeEnvironmentFlags = flags;
    return process.allowedNodeEnvironmentFlags;
  },
  // If the user tries to set this to another value, override
  // this completely to that value.
  set(value) {
    Object.defineProperty(this, 'allowedNodeEnvironmentFlags', {
      value,
      configurable: true,
      enumerable: true,
      writable: true
    });
  },
  enumerable: true,
  configurable: true
});

// process.assert
process.assert = deprecate(
  perThreadSetup.assert,
  'process.assert() is deprecated. Please use the `assert` module instead.',
  'DEP0100');

// TODO(joyeecheung): this property has not been well-maintained, should we
// deprecate it in favor of a better API?
const { isDebugBuild, hasOpenSSL, hasInspector } = config;
Object.defineProperty(process, 'features', {
  enumerable: true,
  writable: false,
  configurable: false,
  value: {
    inspector: hasInspector,
    debug: isDebugBuild,
    uv: true,
    ipv6: true,  // TODO(bnoordhuis) ping libuv
    tls_alpn: hasOpenSSL,
    tls_sni: hasOpenSSL,
    tls_ocsp: hasOpenSSL,
    tls: hasOpenSSL,
    cached_builtins: config.hasCachedBuiltins,
  }
});

{
  const {
    onGlobalUncaughtException,
    setUncaughtExceptionCaptureCallback,
    hasUncaughtExceptionCaptureCallback
  } = require('internal/process/execution');

  // For legacy reasons this is still called `_fatalException`, even
  // though it is now a global uncaught exception handler.
  // The C++ land node::errors::TriggerUncaughtException grabs it
  // from the process object because it has been monkey-patchable.
  // TODO(joyeecheung): investigate whether process._fatalException
  // can be deprecated.
  process._fatalException = onGlobalUncaughtException;
  process.setUncaughtExceptionCaptureCallback =
    setUncaughtExceptionCaptureCallback;
  process.hasUncaughtExceptionCaptureCallback =
    hasUncaughtExceptionCaptureCallback;
}

const { emitWarning } = require('internal/process/warning');
process.emitWarning = emitWarning;

// We initialize the tick callbacks and the timer callbacks last during
// bootstrap to make sure that any operation done before this are synchronous.
// If any ticks or timers are scheduled before this they are unlikely to work.
{
  const { nextTick, runNextTicks } = setupTaskQueue();
  process.nextTick = nextTick;
  // Used to emulate a tick manually in the JS land.
  // A better name for this function would be `runNextTicks` but
  // it has been exposed to the process object so we keep this legacy name
  // TODO(joyeecheung): either remove it or make it public
  process._tickCallback = runNextTicks;

  const { getTimerCallbacks } = require('internal/timers');
  const { setupTimers } = internalBinding('timers');
  const { processImmediate, processTimers } = getTimerCallbacks(runNextTicks);
  // Sets two per-Environment callbacks that will be run from libuv:
  // - processImmediate will be run in the callback of the per-Environment
  //   check handle.
  // - processTimers will be run in the callback of the per-Environment timer.
  setupTimers(processImmediate, processTimers);
  // Note: only after this point are the timers effective
}

function setupPrepareStackTrace() {
  const {
    setEnhanceStackForFatalException,
    setPrepareStackTraceCallback
  } = internalBinding('errors');
  const {
    prepareStackTrace,
    fatalExceptionStackEnhancers: {
      beforeInspector,
      afterInspector
    }
  } = require('internal/errors');
  // Tell our PrepareStackTraceCallback passed to the V8 API
  // to call prepareStackTrace().
  setPrepareStackTraceCallback(prepareStackTrace);
  // Set the function used to enhance the error stack for printing
  setEnhanceStackForFatalException(beforeInspector, afterInspector);
}

function setupProcessObject() {
  const EventEmitter = require('events');
  const origProcProto = Object.getPrototypeOf(process);
  Object.setPrototypeOf(origProcProto, EventEmitter.prototype);
  EventEmitter.call(process);
  Object.defineProperty(process, Symbol.toStringTag, {
    enumerable: false,
    writable: true,
    configurable: false,
    value: 'process'
  });
  // Make process globally available to users by putting it on the global proxy
  Object.defineProperty(global, 'process', {
    value: process,
    enumerable: false,
    writable: true,
    configurable: true
  });
}

function setupProcessStdio(getStdout, getStdin, getStderr) {
  Object.defineProperty(process, 'stdout', {
    configurable: true,
    enumerable: true,
    get: getStdout
  });

  Object.defineProperty(process, 'stderr', {
    configurable: true,
    enumerable: true,
    get: getStderr
  });

  Object.defineProperty(process, 'stdin', {
    configurable: true,
    enumerable: true,
    get: getStdin
  });

  process.openStdin = function () {
    process.stdin.resume();
    return process.stdin;
  };
}

function setupGlobalProxy() {
  Object.defineProperty(global, Symbol.toStringTag, {
    value: 'global',
    writable: false,
    enumerable: false,
    configurable: true
  });

  function makeGetter(name) {
    return deprecate(function () {
      return this;
    }, `'${name}' is deprecated, use 'global'`, 'DEP0016');
  }

  function makeSetter(name) {
    return deprecate(function (value) {
      Object.defineProperty(this, name, {
        configurable: true,
        writable: true,
        enumerable: true,
        value: value
      });
    }, `'${name}' is deprecated, use 'global'`, 'DEP0016');
  }

  Object.defineProperties(global, {
    GLOBAL: {
      configurable: true,
      get: makeGetter('GLOBAL'),
      set: makeSetter('GLOBAL')
    },
    root: {
      configurable: true,
      get: makeGetter('root'),
      set: makeSetter('root')
    }
  });
}

function setupBuffer() {
  const { Buffer } = require('buffer');
  const bufferBinding = internalBinding('buffer');

  // Only after this point can C++ use Buffer::New()
  bufferBinding.setBufferPrototype(Buffer.prototype);
  delete bufferBinding.setBufferPrototype;
  delete bufferBinding.zeroFill;

  Object.defineProperty(global, 'Buffer', {
    value: Buffer,
    enumerable: false,
    writable: true,
    configurable: true
  });
}

function createGlobalConsole(consoleFromVM) {
  const consoleFromNode =
    require('internal/console/global');
  if (config.hasInspector) {
    const inspector = require('internal/util/inspector');
    // This will be exposed by `require('inspector').console` later.
    inspector.consoleFromVM = consoleFromVM;
    // TODO(joyeecheung): postpone this until the first time inspector
    // is activated.
    inspector.wrapConsole(consoleFromNode, consoleFromVM);
    const { setConsoleExtensionInstaller } = internalBinding('inspector');
    // Setup inspector command line API.
    setConsoleExtensionInstaller(inspector.installConsoleExtensions);
  }
  return consoleFromNode;
}

// https://heycam.github.io/webidl/#es-namespaces
function exposeNamespace(target, name, namespaceObject) {
  Object.defineProperty(target, name, {
    writable: true,
    enumerable: false,
    configurable: true,
    value: namespaceObject
  });
}

// https://heycam.github.io/webidl/#es-interfaces
function exposeInterface(target, name, interfaceObject) {
  Object.defineProperty(target, name, {
    writable: true,
    enumerable: false,
    configurable: true,
    value: interfaceObject
  });
}

// https://heycam.github.io/webidl/#define-the-operations
function defineOperation(target, name, method) {
  Object.defineProperty(target, name, {
    writable: true,
    enumerable: true,
    configurable: true,
    value: method
  });
}
