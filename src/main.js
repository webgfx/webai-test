'use strict';

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import yargs from 'yargs';
import util from './util.js';
import browser from './browser.js';

import app from './app.js';
import benchmark from './benchmark.js';
import native from './native.js';
import report from './report.js';
import trace from './trace.js';
import upload from './upload.js';
import workload from './workload.js';
import config from './config.js';

function parseArgs() {
  util.args = yargs(process.argv.slice(2))
    .usage('node $0 [args]')
    .strict()
    .option('app-json', {
      type: 'string',
      describe: 'app json',
      default: 'app.json',
    })
    .option('app-name', {
      type: 'string',
      describe: 'app name to run, split by comma',
    })
    .option('benchmark-json', {
      type: 'string',
      describe: 'benchmark json',
      default: 'benchmark.json',
    })
    .option('browser', {
      type: 'string',
      describe:
        'browser specific path, can be chrome_canary, chrome_dev, chrome_beta or chrome_stable',
      default: 'chrome_canary',
    })
    .option('browser-args', {
      type: 'string',
      describe: 'extra browser args',
    })
    .option('cleanup-user-data-dir', {
      type: 'boolean',
      describe: 'cleanup user data dir',
    })
    .option('conformance-eps', {
      type: 'string',
      describe: 'eps for conformance, split by comma',
    })
    .option('disable-breakdown', {
      type: 'boolean',
      describe: 'disable breakdown',
    })
    .option('email', {
      alias: 'e',
      type: 'string',
      describe: 'email to',
    })
    .option('disable-new-browser', {
      type: 'boolean',
      describe: 'start a new browser for each test',
    })
    .option('enable-trace', {
      type: 'boolean',
      describe: 'enable trace',
    })
    .option('kill-chrome', {
      type: 'boolean',
      describe: 'kill chrome before testing',
    })
    .option('mode', {
      type: 'string',
      describe: 'mode to run, native or web',
      default: 'native',
    })
    .option('model-names', {
      type: 'string',
      describe: 'model names to run, split by comma',
    })
    .option('model-path', {
      type: 'string',
      describe: 'model url',
    })
    .option('native-ep', {
      type: 'string',
      describe: 'ep for native',
    })
    .option('ort-dir', {
      type: 'string',
      describe: 'ort dir',
      default: 'd:/workspace/project/onnxruntime'
    })
    .option('ort-path', {
      type: 'string',
      describe: 'ort path',
    })
    .option('pause-task', {
      type: 'boolean',
      describe: 'pause task',
    })
    .option('performance-eps', {
      type: 'string',
      describe: 'eps for performance, split by comma',
    })
    .option('repeat', {
      type: 'number',
      describe: 'repeat times',
      default: 1,
    })
    .option('server-info', {
      type: 'boolean',
      describe: 'get server info and display it in report',
    })
    .option('skip-config', {
      type: 'boolean',
      describe: 'skip config',
      default: false,
    })
    .option('tasks', {
      type: 'string',
      describe:
        'test tasks, split by comma, can be conformance, performance, trace, upload, workload, syncNative, buildNative, runNative, app and so on.',
      default: 'conformance,performance',
    })
    .option('timestamp', {
      type: 'string',
      describe: 'timestamp',
    })
    .option('timestamp-format', {
      type: 'string',
      describe: 'timestamp format, day or second',
      default: 'second',
    })
    .option('web-url', {
      type: 'string',
      describe: 'web url to test against',
    })
    .option('web-url-args', {
      type: 'string',
      describe: 'extra web url args',
    })
    .option('trace-file', {
      type: 'string',
      describe: 'trace file',
    })
    .option('upload', {
      type: 'boolean',
      describe: 'upload result to server',
    })
    .option('workload-timeout', {
      type: 'number',
      describe: 'workload timeout in seconds',
      default: 5,
    })
    .option('workload-url', {
      type: 'string',
      describe: 'workload url',
    })
    .option('device-type', {
      type: 'string',
      describe: 'device type',
      default: 'default',
    })
    .option('disable-buffer', {
      type: 'boolean',
      describe: 'disable buffer',
      default: false,
    })
    .option('disable-readback', {
      type: 'boolean',
      describe: 'disable readback',
      default: false,
    })
    .option('ep', {
      type: 'string',
      describe: 'ep, can be webgpu or cpu',
      default: 'webgpu',
    })
    .option('enable-debug', {
      type: 'boolean',
      describe: 'enable debug',
      default: false,
    })
    .option('enable-free-dimension-overrides', {
      type: 'boolean',
      describe: 'enable free dimension overrides',
      default: true,
    })
    .option('enable-graph-capture', {
      type: 'boolean',
      describe: 'enable graph capture',
      default: false,
    })
    .option('enable-io-binding', {
      type: 'boolean',
      describe: 'enable io binding',
      default: false,
    })
    .option('enable-trace', {
      type: 'boolean',
      describe: 'enable trace',
      default: false,
    })
    .option('external-data', {
      type: 'string',
      describe: 'external data',
      default: '',
    })
    .option('log-level', {
      type: 'string',
      describe: 'verbose, info, warning, error, fatal',
      default: 'error',
    })
    .option('log-severity-level', {
      type: 'number',
      describe: 'Log severity level. Applies to session load, initialization, etc. 0:Verbose, 1:Info, 2:Warning. 3:Error, 4:Fatal. Default is 2.',
      default: 3,
    })
    .option('log-verbosity-level', {
      type: 'number',
      describe: 'VLOG level if DEBUG build and session_log_severity_level is 0. Applies to session load, initialization, etc. Default is 0.',
      default: 0,
    })
    .option('opt-level', {
      type: 'string',
      describe: 'opt level, can be all, basic, disabled, extended',
      default: 'all',
    })
    .option('model-names', {
      type: 'string',
      describe: 'model-names, split by comma',
      default: 'mobilenetv2-12',
    })
    .option('run-times', {
      type: 'number',
      describe: 'run times',
      default: 1,
    })
    .option('task', {
      type: 'string',
      describe: 'task',
      default: 'performance',
    })
    .option('warmup-times', {
      type: 'number',
      describe: 'warmup times',
      default: 0,
    })
    .option('webgpu-layout', {
      type: 'string',
      describe: 'webgpu layout',
      default: 'NHWC',
    })
    .option('wasm-threads', {
      type: 'number',
      describe: 'wasm threads',
      default: 4,
    })
    .example([
      ['node $0 --email a@intel.com;b@intel.com // Send report to emails'],
      [
        'node $0 --tasks performance --web-url http://127.0.0.1/workspace/project/onnxruntime'
      ],
      [
        'node $0 --tasks performance --model-name pose-detection --architecture BlazePose-heavy --input-size 256 --input-type tensor --performance-eps webgpu',
      ],
      [
        'node $0 --browser-args="--enable-dawn-features=disable_workgroup_init --no-sandbox --enable-zero-copy"'
      ],
      [
        'node $0 --tasks performance --model-name mobilenetv2-12 --performance-eps webgpu --warmup-times 0 --run-times 1 --server-info --disable-new-browser',
      ],
      [
        'node $0 --tasks performance --model-name mobilenetv2-12 --performance-eps webgpu --warmup-times 0 --run-times 1 --timestamp-format day',
      ],
      ['node $0 --enable-trace --timestamp 20220601'],
      [
        'node $0 --tasks conformance --conformance-ep webgpu --model-name mobilenetv2-12 --timestamp-format day --skip-config // single test',
      ],
      [
        'node $0 --tasks performance --performance-eps webgpu --model-name mobilenetv2-12 --timestamp-format day --skip-config // single test',
      ],
      [
        'node $0 --tasks conformance --timestamp-format day --benchmark-json benchmark-wip.json --web-url https://xxx/project/webatintel/webai-test'
      ],
      [
        'node $0 --tasks performance --performance-eps webgpu --model-name mobilenetv2-12 --enable-trace --ort-path gh/20231215-trace --timestamp-format day',
      ],
      [
        'node $0 --tasks trace --timestamp 20231218 --trace-file workload-webgpu-trace',
      ],
      [
        'node $0 --tasks runNative --model-name mobilenetv2-12 --run-times 100 --native-ep dml',
      ],
      [
        'node $0 --tasks app --browser-args="--proxy-server=<proxy>"',
      ],
    ])
    .help()
    .wrap(180)
    .argv;

  util.mode = util.args['mode'];

  if (util.args['mode'] === 'web') {
    browser.setup();
    if ('ort-path' in util.args) {
      util.ortPath = util.args['ort-path'];
    } else {
      util.ortPath = `https://${util.server}/project/onnxruntime`;
    }

    if ('web-url' in util.args) {
      util.webUrl = util.args['web-url'];
    } else {
      util.webUrl = `https://${util.server}/project/webai-test`;
    }

    if ('web-url-args' in util.args) {
      util.webUrlArgs.push(...util.args['web-url-args'].split('&'));
    }

    util.allEps = ['webgpu', 'wasm'];
  } else {
    util.allEps = ['webgpu'];
  }

  if ('model-path' in util.args) {
    util.modelPath = util.args['model-path'];
  } else if (util.args['mode'] === 'web') {
    util.modelPath = util.server;
  } else {
    util.modelPath = 'd:/workspace/project/models';
  }

  let warmupTimes;
  if ('warmup-times' in util.args) {
    warmupTimes = parseInt(util.args['warmup-times']);
  } else {
    warmupTimes = 10;
  }
  util.warmupTimes = warmupTimes;

  let runTimes;
  if ('run-times' in util.args) {
    runTimes = parseInt(util.args['run-times']);
  } else {
    runTimes = 5;
  }
  util.runTimes = runTimes;
}

async function main() {
  parseArgs();
  let tasks = util.args['tasks'].split(',');

  if (!fs.existsSync(util.outDir)) {
    fs.mkdirSync(util.outDir, { recursive: true });
  }

  if (!util.args['skip-config']) {
    await config.getConfig();
  }

  if (util.args['mode'] === 'web') {
    for (let task of tasks) {
      if (['conformance', 'performance'].indexOf(task) >= 0) {
        console.log(`Use browser at ${util.browserPath}`);
        console.log(`Use user-data-dir at ${util.userDataDir}`);
        break;
      }
    }
  }

  let results = {};
  util.duration = '';

  for (let i = 0; i < util.args['repeat']; i++) {
    util.timestamp = util.getTimestamp(util.args['timestamp-format']);
    util.timestampDir = path.join(util.outDir, util.timestamp);
    util.ensureDir(util.timestampDir);
    util.logFile = path.join(util.timestampDir, `${util.timestamp}.log`);
    if (fs.existsSync(util.logFile)) {
      fs.truncateSync(util.logFile, 0);
    }

    if (util.args['repeat'] > 1) {
      util.log(`== Test round ${i + 1}/${util.args['repeat']} ==`);
    }

    let needReport = false;
    for (let task of tasks) {
      let startTime = new Date();
      util.task = task;
      util.log(`Start task ${task}`);
      if (['conformance', 'performance'].indexOf(task) >= 0) {
        results[task] = await benchmark.run();
        needReport = true;
      } else if (task === 'trace') {
        await trace.parseTrace();
      } else if (task === 'workload') {
        workload.workload();
      } else if (task === 'syncNative') {
        native.syncNative();
      } else if (task === 'buildNative') {
        native.buildNative();
      } else if (task === 'runNative') {
        native.runNative();
      } else if (task === 'app') {
        results[task] = await app.runApp();
        needReport = true;
      }
      util.duration += `${task}: ${(new Date() - startTime) / 1000} `;
      util.log(`End task ${task}`);
    }

    if (needReport) {
      await report.report(results);
    }
  }
}

main();
