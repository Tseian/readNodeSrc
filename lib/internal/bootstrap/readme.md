## bootstrap 
模块主要是在进程启动前对process这个对象进行封装，将起送进程是的参数，配置，还有一部分方法挂载到process对象上，当我们在自己的代码中可以使用的变量process.argv0
loader.js 在nodejs运行被node.cc编译运行，用以加载 c++绑定器 模块加载器(internalBinding,_linkedBinding),初始化moduleLoadList必要的属性，返回{internalBinding,
  NativeModule,
  require: nativeModuleRequire}这个对象到node中