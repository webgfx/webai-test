'use strict';

import { exec } from 'child_process';
import { exit } from 'process';
import path from 'path';
import util from './util.js';

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
  const cmd = exec('python ort.py --build-native')
  cmd.stdout.on('data', util.stdoutOnData);
  cmd.stderr.on('data', util.stderrorOnData);
  cmd.on('close', util.onClose);
}

function runNative() {
  process.chdir(path.join(util.args['ortDir'], 'build/Windows/Release/Release'));

  // cpu|cuda|dnnl|tensorrt|openvino|dml|acl|nnapi|coreml|qnn|snpe|rocm|migraphx|xnnpack|vitisai
  const ep = util.args['native-ep'] || 'dml';

  let modelName = util.args['model-name'];

  let cmdStr = `onnxruntime_perf_test.exe -I -r ${util.runTimes}`;
  for (let key in freeDimensionOverrides[modelName]) {
    cmdStr += ` -f ${key}:${freeDimensionOverrides[modelName][key]}`;
  }
  cmdStr += ` -e ${ep}`;
  if (ep === 'cpu') {
    cmdStr += ` -x ${util.cpuThreads}`;
  }

  cmdStr += ` ${path.join('d:/workspace/project/models', util.args['model-name'] + '.onnx')}`;
  console.log(`[cmd] onnxruntime_perf_test.exe ${cmdStr}`);

  const cmd = exec(cmdStr);
  cmd.stdout.on('data', util.stdoutOnData);
  cmd.stderr.on('data', util.stderrorOnData);
}

export default { syncNative, buildNative, runNative };
