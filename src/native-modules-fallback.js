/**
 * Native modules fallback handler
 * 用于处理原生模块加载失败的情况
 */

// 由于我们已经移除了有问题的nodegit模块，这个文件现在主要用于兼容性
console.log('Native modules fallback handler loaded');

// 如果需要，可以在这里添加其他原生模块的fallback逻辑
module.exports = {}; 