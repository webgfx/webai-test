'use strict';

import { fileURLToPath } from 'url';
import fs from 'fs';
import nodemailer from 'nodemailer';
import os from 'os';
import path from 'path';

let browserArgs = ['--enable-features=SharedArrayBuffer', '--start-maximized', '--auto-accept-camera-and-microphone-capture', '--ignore-certificate-errors'];
// webgpu
browserArgs.push(
  ...['--enable-webgpu-developer-features']);

let parameters = ['modelName', 'eps'];

let platform = os.platform();

let allEps = [];
let args = {};

// please make sure these metrics are shown up in order
let taskMetrics = {
  conformance: ['result'],
  performance: ['first', 'average', 'best'],
};

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const outDir = path.join(path.resolve(dirname), '../out');
ensureDir(outDir);

const sshKey = path.join(os.homedir(), '.ssh/id_rsa_common');
const remoteCmdArgs = fs.existsSync(sshKey) ? `-i ${sshKey}` : '';

async function asyncFunctionWithTimeout(asyncPromise, timeout) {
  let timeoutHandle;

  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Async function timeout limit reached')),
      timeout);
  });

  return Promise.race([asyncPromise, timeoutPromise]).then(result => {
    clearTimeout(timeoutHandle);
    return result;
  })
}

const average = array => getFloat(array.reduce((a, b) => a + b) / array.length, 2);

function capitalize(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function uncapitalize(s) {
  return s[0].toLowerCase() + s.slice(1);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

function ensureNoDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function ensureNoFile(file) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

function getDuration(start, end) {
  let diff = Math.abs(start - end);
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);
  diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);
  return `${hours}:${('0' + minutes).slice(-2)}:${('0' + seconds).slice(-2)}`;
}

function getFloat(value) {
  return Math.round(parseFloat(value) * 100) / 100;
}

async function getIframe(page, selector) {
  const iframeElement = await page.waitForSelector(selector);
  return await iframeElement.contentFrame();
}

function getTimestamp(format) {
  const date = new Date();
  let timestamp = date.getFullYear() + padZero(date.getMonth() + 1) +
    padZero(date.getDate());
  if (format === 'second') {
    timestamp += padZero(date.getHours()) + padZero(date.getMinutes()) +
      padZero(date.getSeconds());
  }
  return timestamp;
}

function intersect(a, b) {
  if (!Array.isArray(a)) {
    a = [a];
  }
  if (!Array.isArray(b)) {
    b = [b];
  }
  return a.filter((v) => b.includes(v));
}

function log(info) {
  fs.appendFileSync(this.logFile, String(info) + '\n');
  console.info(`[Info] ${info}`);
}

function padZero(str) {
  return ('0' + str).slice(-2);
}

function scp(src, dest) {
  return `scp ${remoteCmdArgs} ${src} ${dest}`;
}

function upload(file, serverFolder) {
  serverFolder = `${serverFolder}/${util.platform}/${util['gpuDeviceId']}`;
  let result = spawnSync(util.ssh(`ls ${serverFolder}`), { shell: true });
  if (result.status != 0) {
    spawnSync(util.ssh(`mkdir -p ${serverFolder}`), { shell: true });
  }

  result = spawnSync(
    util.scp(file, `${util.server}:${serverFolder}`), { shell: true });
  if (result.status !== 0) {
    util.log('[ERROR] Failed to upload file');
  } else {
    util.log(`[INFO] File was successfully uploaded to ${serverFolder}`);
  }
};

async function sendMail(to, subject, html) {
  let from = "webgraphics@intel.com";

  let transporter = nodemailer.createTransport({
    host: "ecsmtp.pdx.intel.com",
    port: 25,
    secure: false,
    auth: false,
  });

  transporter.verify((error) => {
    if (error) {
      console.log("transporter error: ", error);
    } else {
      console.log("Email was sent!");
    }
  });

  let info = await transporter.sendMail({
    from: from,
    to: to,
    subject: subject,
    html: html,
  });
  return Promise.resolve();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ssh(cmd, server) {
  return `ssh ${remoteCmdArgs} ${server} ${cmd}`;
}

function stdoutOnData(data) {
  console.log(`${data}`);
}

function stderrorOnData(data) {
  console.log(`${data}`);
}

function onClose(code) {
  console.log(`process exited with code ${code}`);
}


const displayPrecision = 2;

function getSum(data) {
  return data.reduce((accumulator, currentValue) => { return accumulator + currentValue }, 0);
}

function toggleClass(el, className) {
  if (el.className.indexOf(className) >= 0) {
    el.className = el.className.replace(className, '');
  } else {
    el.className += className;
  }
}

function reportStatus(status) {
  console.log(status);
}

function compare(actual, expected, epsilons) {
  try {
    areCloseObjects(actual, expected, epsilons);
  } catch (e) {
    console.error(e);
    return false;
  }
  return true;
}

function areCloseObjects(actual, expected, epsilons) {
  let actualKeys = Object.keys(actual);
  let expectedKeys = Object.keys(expected);
  if (actualKeys.length != expectedKeys.length) {
    throw new Error(`Actual length ${actualKeys.length} not equal Expected length ${expectedKeys.length}`);
  }
  for (let i = 0; i < actualKeys.length; i++) {
    let key = actualKeys[i];
    let isArray = isTypedArray(actual[key]) && isTypedArray(expected[key]);
    let isObject = typeof (actual[key]) === 'object' && typeof (expected[key]) === 'object';
    if (isArray) {
      areCloseArrays(actual[key], expected[key], epsilons);
    } else if (isObject) {
      areCloseObjects(actual[key], expected[key], epsilons);
    } else {
      if (!areClosePrimitives(actual[key], expected[key], epsilons)) {
        throw new Error(`Objects differ: actual[${key}] = ${JSON.stringify(actual[key])}, expected[${key}] = ${JSON.stringify(expected[key])}!`);
      }
    }
  }
  return true;
}

function areCloseArrays(actual, expected, epsilons) {
  let checkClassType = true;
  if (isTypedArray(actual) || isTypedArray(expected)) {
    checkClassType = false;
  }
  if (isTypedArray(actual) && isTypedArray(expected)) {
    checkClassType = true;
  }
  if (checkClassType) {
    const aType = actual.constructor.name;
    const bType = expected.constructor.name;

    if (aType !== bType) {
      throw new Error(`Arrays are of different type. Actual: ${aType}. Expected: ${bType}`);
    }
  }

  const actualFlat = isTypedArray(actual) ? actual : flatten(actual);
  const expectedFlat = isTypedArray(expected) ? expected : flatten(expected);

  if (actualFlat.length !== expectedFlat.length) {
    throw new Error(
      `Arrays have different lengths actual: ${actualFlat.length} vs ` +
      `expected: ${expectedFlat.length}.\n` +
      `Actual:   ${actualFlat}.\n` +
      `Expected: ${expectedFlat}.`);
  }
  for (let i = 0; i < expectedFlat.length; ++i) {
    const a = actualFlat[i];
    const e = expectedFlat[i];

    if (!areClosePrimitives(a, e, epsilons)) {
      throw new Error(
        `Arrays differ: actual[${i}] = ${a}, expected[${i}] = ${e}.\n` +
        `Actual:   ${actualFlat}.\n` +
        `Expected: ${expectedFlat}.`);
    }
  }
}

function areClosePrimitives(actual, expected, epsilons) {
  if (isNaN(actual) || isNaN(expected)) {
    return false;
  } else if (!isFinite(actual) && !isFinite(expected)) {
    return true;
  }

  const error = Math.abs(actual - expected);
  if (Math.abs(actual) >= 1) {
    const errorRatio = error / Math.min(Math.abs(actual), Math.abs(expected));
    if ((error > epsilons[0]) || errorRatio > epsilons[1]) {
      console.error(`actual=${actual}, expected=${expected}`);
      return false;
    }
  } else {
    if (error > epsilons[1]) {
      console.error(`actual=${actual}, expected=${expected}`);
      return false;
    }
  }
  return true;
}

function isTypedArray(object) {
  return ArrayBuffer.isView(object) && !(object instanceof DataView);
}

const type_to_func = {
  float32: Float32Array,
  uint16: Uint16Array,
  float16: Uint16Array,
  int32: Int32Array,
  BigInt64Array: BigInt64Array,
  int64: BigInt64Array,
  bool: Uint8Array,
};

function clone(x) {
  let feed = {};
  for (const [key, value] of Object.entries(x)) {
    let func = type_to_func[value.type];
    let arrayType = func.from(value.data);
    feed[key] = new ort.Tensor(value.type, arrayType.slice(0), value.dims);
  }
  return feed;
}

// https://gist.github.com/mfirmin/456e1c6dcf7b0e1bda6e940add32adad
// This function converts a Float16 stored as the bits of a Uint16 into a Javascript Number.
function float16ToNumber(input) {
  // Create a 32 bit DataView to store the input
  const arr = new ArrayBuffer(4);
  const dv = new DataView(arr);

  // Set the Float16 into the last 16 bits of the dataview
  // So our dataView is [00xx]
  dv.setUint16(2, input, false);

  // Get all 32 bits as a 32 bit integer
  // (JS bitwise operations are performed on 32 bit signed integers)
  const asInt32 = dv.getInt32(0, false);

  // All bits aside from the sign
  let rest = asInt32 & 0x7fff;
  // Sign bit
  let sign = asInt32 & 0x8000;
  // Exponent bits
  const exponent = asInt32 & 0x7c00;

  // Shift the non-sign bits into place for a 32 bit Float
  rest <<= 13;
  // Shift the sign bit into place for a 32 bit Float
  sign <<= 16;

  // Adjust bias
  // https://en.wikipedia.org/wiki/Half-precision_floating-point_format#Exponent_encoding
  rest += 0x38000000;
  // Denormals-as-zero
  rest = (exponent === 0 ? 0 : rest);
  // Re-insert sign bit
  rest |= sign;

  // Set the adjusted float32 (stored as int32) back into the dataview
  dv.setInt32(0, rest, false);

  // Get it back out as a float32 (which js will convert to a Number)
  const asFloat32 = dv.getFloat32(0, false);

  return asFloat32;
}

function renderData(heads, data, title) {
  let row, th, td;

  // title
  let h = document.createElement("h3");
  h.innerHTML = title;
  h.align = "center";
  document.body.appendChild(h);

  // table
  let table = document.createElement("table");
  table.className = "sortable";
  table.align = "center";
  table.style.width = "80%";
  table.setAttribute("border", "1");
  document.body.appendChild(table);

  // thead
  let header = table.createTHead("thead");
  row = header.insertRow(0);
  row.style.fontWeight = "bold";
  for (let head of heads) {
    let th = document.createElement("th");
    th.innerHTML = head;
    row.appendChild(th);
  }

  // tbody
  let tbody = document.createElement("tbody");
  table.appendChild(tbody);
  // rest of line
  for (let i = 0; i < data.length; ++i) {
    let rowInfo = data[i];
    row = tbody.insertRow(i);
    row.onclick = function () {
      toggleClass(this, "highlight");
    };
    for (let j = 0; j < heads.length; j++) {
      td = row.insertCell(j);
      let cellInfo = rowInfo[j];
      if (heads[j].startsWith("Time")) {
        cellInfo = cellInfo.toFixed(displayPrecision);
      }
      td.innerHTML = cellInfo;
    }
  }

  // tfoot
  let needTfoot = false;
  for (let i = 0; i < heads.length; ++i) {
    if (heads[i].startsWith("Time")) {
      needTfoot = true;
      break;
    }
  }
  if (needTfoot) {
    let tfoot = document.createElement("tfoot");
    table.appendChild(tfoot);
    row = tfoot.insertRow(0);
    row.style.fontWeight = "bold";
    let sums = new Array(heads.length).fill("");
    sums[0] = "Sum";
    for (let i = 0; i < heads.length; ++i) {
      if (!heads[i].startsWith("Time")) {
        continue;
      }

      let sum = 0;
      for (let j = 0; j < data.length; j++) {
        sum += data[j][i];
      }
      sums[i] = sum.toFixed(displayPrecision);
    }
    for (let i = 0; i < heads.length; ++i) {
      td = row.insertCell(i);
      td.innerHTML = sums[i];
    }
  }

  // blank line
  document.body.appendChild(document.createElement("p"));
}

function renderAggregatedData(heads, data, title) {
  let kernelTime = {};
  for (let d of data) {
    let kernel = d[1];
    if (!(kernel in kernelTime)) {
      kernelTime[kernel] = d[2];
    } else {
      kernelTime[kernel] += d[2];
    }
  }
  let totalTime = getSum(Object.values(kernelTime));
  let keys = Object.keys(kernelTime);
  let sortedKernelTime = keys.sort(function (a, b) {
    return kernelTime[b] - kernelTime[a];
  });
  let sortedAggregatedData = [];
  for (let kernel of sortedKernelTime) {
    let time = kernelTime[kernel];
    sortedAggregatedData.push([kernel, time, ((time / totalTime) * 100).toFixed(2)]);
  }

  renderData(heads, sortedAggregatedData, title);
}

export default {
  dirname: dirname,
  average: average,
  allEps: [],
  conformanceEps: [],
  cpuCount: os.cpus().length,
  breakdown: false,
  browserArgs: browserArgs,
  hostname: os.hostname(),
  outDir: outDir,
  parameters: parameters,
  performanceEps: ['webgpu'],
  platform: platform,
  server: 'webgfx-02.guest.corp.microsoft.com',
  taskMetrics: taskMetrics,
  timeout: 90 * 1000,
  toolkitUrl: '',
  toolkitUrlArgs: [],
  unitEps: [],
  updateModelNames: [],

  asyncFunctionWithTimeout: asyncFunctionWithTimeout,
  capitalize: capitalize,
  ensureDir: ensureDir,
  ensureNoDir: ensureNoDir,
  ensureNoFile: ensureNoFile,
  getDuration: getDuration,
  getFloat: getFloat,
  getIframe: getIframe,
  getSum: getSum,
  getTimestamp: getTimestamp,
  intersect: intersect,
  log: log,
  scp: scp,
  sendMail: sendMail,
  sleep: sleep,
  stdoutOnData: stdoutOnData,
  stderrorOnData: stderrorOnData,
  onClose: onClose,
  ssh: ssh,
  uncapitalize: uncapitalize,

  compare,
  renderData,
  renderAggregatedData,
  reportStatus,
};
