'use strict';

const { exec } = require('child_process');
const path = require('path');
const util = require('./util.js');

const freeDimensionOverrides = {
  'mobilenetv2-12': { batch_size: 1 },
}

function syncNative() {
  process.chdir(util.args['ortDir']);
  const cmd = exec('git pull origin main');
  cmd.stdout.on('data', util.stdoutOnData);
  cmd.stderr.on('data', util.stderrorOnData);
  cmd.on('close', util.onClose);
}

function buildNative() {
  process.chdir(util.args['ortDir']);
  const cmd = exec(`build.bat --config Release --build_shared_lib --parallel ${util.cpuCount * 2} --use_dml --use_xnnpack --use_webgpu --skip_test --skip_submodule_sync --cmake_extra_defines onnxruntime_BUILD_UNIT_TESTS=ON`);
  cmd.stdout.on('data', util.stdoutOnData);
  cmd.stderr.on('data', util.stderrorOnData);
  cmd.on('close', util.onClose);
}

function runNative() {
  process.chdir(path.join(util.args['ortDir'], 'build/Windows/Release/Release'));

  // cpu|cuda|dnnl|tensorrt|openvino|dml|acl|nnapi|coreml|qnn|snpe|rocm|migraphx|xnnpack|vitisai
  const ep = util.args['native-ep'] || 'dml';

  let modelName = util.args['model-name'];

  let cmdStr = `-I -r ${util.runTimes}`;
  for (let key in freeDimensionOverrides[modelName]) {
    cmdStr += ` -f ${key}:${freeDimensionOverrides[modelName][key]}`;
  }
  cmdStr += ` -e ${ep}`;
  if (ep === 'cpu') {
    cmdStr += ` -x ${util.cpuThreads}`;
  } else if (ep === 'dml') {
    cmdStr += ' -i performance_preference|high_performance';
  }
  cmdStr += ` ${path.join('d:/workspace/project/ort-models', util.args['model-name'] + '.onnx')}`;
  console.log(`[cmd] onnxruntime_perf_test.exe ${cmdStr}`);

  const cmd = exec('onnxruntime_perf_test.exe', cmdStr.split(' '));
  cmd.stdout.on('data', util.stdoutOnData);
  cmd.stderr.on('data', util.stderrorOnData);
}

module.exports = { syncNative, buildNative, runNative };
