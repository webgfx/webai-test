"use strict";

import ort from 'onnxruntime-node';
import fs from 'fs/promises';
import util from './util.js';
import models from './models.js';

// For webgpuProfiling, layout conversion is done in first run, so we need to collect data of second run.
async function run() {
  let modelName = util.args['model-name'];
  let deviceType = util.args['device-type'];
  let disableReadback = util.args['disable-readback'];
  let disableBuffer = util.args['disable-buffer'];
  const ep = util.args['ep'];
  let enableDebug = util.args['enable-debug'];
  let enableFreeDimensionOverrides = util.args['enable-free-dimension-overrides'];
  let enableGraphCapture = util.args['enable-graph-capture'];
  let enableIoBinding = util.args['enable-io-binding'];
  let enableTrace = util.args['enable-trace'];
  let externalData = util.args['external-data'];
  let logLevel = util.args['log-level'];
  let logSeverityLevel = util.args['log-severity-level'];
  let logVerbosityLevel = util.args['log-verbosity-level'];
  let optLevel = util.args['opt-level'];
  const task = util.args['task'];
  let webgpuLayout = util.args['webgpu-layout'];

  // globals
  let modelBuffer;
  let originConsoleLog;
  let ortProfilingData = [];
  let ortProfilingIndex = 0;
  const unitConversionFactor = 1000000;
  let webgpuDevice;
  let webgpuProfilingData = [];
  let webgpuProfilingIndex = 0;

  if (deviceType === "default") {
    if (ep === "cpu") {
      deviceType = "cpu";
    } else {
      deviceType = "gpu";
    }
  }

  if (disableReadback === "default") {
    if (ep === "webgpu" && task !== "conformance") {
      disableReadback = true;
    } else {
      disableReadback = false;
    }
  }

  if (enableDebug) {
    ort.env.debug = true;
  }

  if (enableGraphCapture === "default") {
    if (ep === "webgpu" && getGraphCaptureInfo(modelName)) {
      enableGraphCapture = true;
    } else {
      enableGraphCapture = false;
    }
  }
  if (enableGraphCapture) {
    enableIoBinding = true;
  }

  if (enableTrace) {
    ort.env.trace = true;
  }

  if (logLevel) {
    ort.env.logLevel = logLevel;
  }

  if (task === "conformance" && ep === "webgpu" && enableIoBinding && util.runTimes === 0) {
    util.runTimes = 2;
  } else if (util.runTimes === 0) {
    util.runTimes = 5;
  }

  let sessionStartTime = performance.now();
  let results = [];
  let totalTime = 0;
  let webgpuInputBuffer = {};

  if (task === "conformance" && disableReadback) {
    throw Error("Can not set disableReadback for conformance");
  }

  // override console.log
  if (task.includes("Profiling")) {
    originConsoleLog = console.log;
    console.log = function () {
      processConsoleLog(arguments);
      originConsoleLog.apply(this, arguments);
    };
  }

  const sessionOptions = {
    executionProviders: [
      {
        name: ep,
        deviceType: deviceType,
      },
    ],
    graphOptimizationLevel: optLevel,
    logSeverityLevel: logSeverityLevel,
    logVerbosityLevel: logVerbosityLevel,
  };

  modelBuffer = await fs.readFile(`${util.dirname}/../../models/${modelName}.onnx`);

  if (externalData !== "") {
    let data, path;

    if (disableBuffer) {
      data = externalData;
    } else {
      data = await getOPFS(`${modelName}.data`, externalData, false);
    }

    path = externalData.split('/').pop();

    sessionOptions.externalData = [
      {
        data: data,
        path: path,
      }
    ];
  }

  if (ep === "webgpu" && enableGraphCapture) {
    sessionOptions.enableGraphCapture = true;
  }

  if (ep === "webgpu" && (disableReadback || enableIoBinding)) {
    sessionOptions.preferredOutputLocation = "gpu-buffer";
  }

  if (ep === "webgpu") {
    sessionOptions.executionProviders[0].preferredLayout = webgpuLayout;
  }

  if (task === "ortProfiling") {
    sessionOptions.enableProfiling = true;
  }

  // create session
  const sessionCreateStartTime = performance.now();
  util.session = await ort.InferenceSession.create(modelBuffer, sessionOptions);

  if (ep === "webgpu") {
    webgpuDevice = ort.env.webgpu.device;
  }

  if (!util.feedsInfo) {
    models.getFeedsInfo(modelName, util.session);
  }
  const elapsedTimeSession = parseFloat((performance.now() - sessionCreateStartTime).toFixed(2));
  console.info(`${elapsedTimeSession}ms was used to create session`);

  const runOptions = {
    logSeverityLevel: logSeverityLevel,
    logVerbosityLevel: logVerbosityLevel,
  };

  // run a task
  for (let i = 0; i < util.warmupTimes + util.runTimes; i++) {
    let result;
    let feeds = {};

    if (!sessionStartTime) {
      sessionStartTime = performance.now();
    }
    util.reportStatus(`Running task ${task} ${i} ...`);

    if ((i === util.warmupTimes + 1 || util.runTimes == 1) && task === "webgpuProfiling") {
      ort.env.webgpu.profiling = { mode: "default" };
    }

    for (const [feed, [type, data, dims, bufferSize]] of util.feedsInfo[i]) {
      if (ep === "webgpu" && enableIoBinding) {
        if (!(bufferSize in webgpuInputBuffer)) {
          webgpuInputBuffer[bufferSize] = webgpuDevice.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
          });
        }

        webgpuDevice.queue.writeBuffer(webgpuInputBuffer[bufferSize], 0, data);
        feeds[feed] = ort.Tensor.fromGpuBuffer(webgpuInputBuffer[bufferSize], { dataType: type, dims });
      } else {
        feeds[feed] = new ort.Tensor(type, data, dims);
      }
    }

    result = await util.session.run(feeds, runOptions);

    if (ep === "webgpu" && (disableReadback || enableIoBinding)) {
      await webgpuDevice.queue.onSubmittedWorkDone();
    }

    if (task === "conformance") {
      results.push([]);
      let index = results.length - 1;
      let _result;
      for (let i = 0; i < util.session.outputNames.length; i++) {
        if (ep === "webgpu" && enableIoBinding) {
          _result = await result[util.session.outputNames[i]].getData(true);
        } else {
          _result = result[util.session.outputNames[i]]["data"];
        }
        if (_result instanceof Uint16Array && modelName.endsWith("-f16")) {
          const _f16Result = [];
          for (let j = 0; j < _result.length; j++) {
            _f16Result.push(float16ToNumber(_result[j]));
          }
          results[index].push(_f16Result);
        } else {
          results[index].push(_result);
        }
      }
    } else if (i === 0 || i >= util.warmupTimes) {
      const elapsedTime = parseFloat((performance.now() - sessionStartTime).toFixed(2));
      results.push(elapsedTime);
    }
    sessionStartTime = null;

    if ((i === util.warmupTimes + 1 || util.runTimes == 1) && task === "webgpuProfiling") {
      ort.env.webgpu.profiling = { mode: "" };
      break;
    }
  }

  // release session
  util.session.release();

  // restore console.log
  if (task.includes("Profiling")) {
    console.log = originConsoleLog;
  }

  return results;
}

function getResult(task, data) {
  let result = {};

  if (task === "conformance") {
    let _results = [];
    for (let i = 0; i < data[0].length; i++) {
      _results.push([]);
      for (let j = 0; j < data[0][i].length; j++) {
        _results[i].push(util.compare(data[0][i][j], data[1][i][j], models.getEpsilons(modelName)));
      }
      _results[i] = `[${_results[i].join(", ")}]`;
    }
    result["result"] = _results.join(", ");

    for (let i = 0; i < data.length; i++) {
      console.info(data[i]);
    }
  } else if (task === "performance") {
    let details = data.join(", ");
    if (util.mode === "web") {
      let detailsElement = document.createElement("p");
      document.body.appendChild(detailsElement);
      detailsElement.innerText = details;
    } else {
      console.info(details);
    }

    result["first"] = data[0];
    data.shift();
    let totalTime = util.getSum(data);
    let averageTime = parseFloat((totalTime / data.length).toFixed(2));
    result["average"] = averageTime;
    result["best"] = Math.min(...data);
  }

  if (task === "conformance" || task === "performance") {
  } else if (task.includes("Profiling")) {
    resultElement.innerText = `${data[data.length - 1]}ms`;
    if (task === "ortProfiling") {
      renderAggregatedData(["Kernel", "Time (ms)", "Percentage (%)"], ortProfilingData, 'ORT Aggregated Profiling Data');
      renderData(["Index", "Kernel", "Time (ms)", "Shape", "Provider"], ortProfilingData, 'ORT Profiling Data');
    }
    if (task === "webgpuProfiling") {
      renderAggregatedData(["Kernel", "Time (ms)", "Percentage (%)"], webgpuProfilingData, 'WebGPU Aggregated Profiling Data');
      renderData(["Index", "Kernel", "Time (ms)", "Shape"], webgpuProfilingData, 'WebGPU Profiling Data');
    }
  }

  return result;
}

export default {
  run,
  getResult,
};
