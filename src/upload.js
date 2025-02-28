"use strict";

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import util from './util.js';

let startDate = "20230101";
let endDate = "20230105";

async function upload() {
  if (!util["gpuDeviceId"]) {
    return;
  }
  let folders = fs.readdirSync(util.outDir);
  let fullPath, stat, result;
  for (let folder of folders) {
    // check if folder is effective
    if (isNaN(folder)) {
      continue;
    }
    fullPath = path.join(util.outDir, folder);
    stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) {
      continue;
    }

    // check if date is in range
    let folderDate = folder.substring(0, 8);
    if (parseInt(folderDate) < parseInt(startDate) || parseInt(folderDate) > parseInt(endDate)) {
      continue;
    }
    let fileName = `${folderDate}.json`;

    // check if file exists
    fullPath = path.join(fullPath, fileName);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    // check if file exists in remote
    let serverFolder = `/workspace/project/work/ort/perf/${util.platform}/${util["gpuDeviceId"]}`;
    result = spawnSync(util.ssh(`ls ${serverFolder}/${fileName}`), { shell: true });
    if (result.status == 0) {
      util.log(`[INFO] ${fullPath} already exists in server`);
      continue;
    }

    // upload the file
    result = spawnSync(util.scp(fullPath, `${util.server}:${serverFolder}`), { shell: true });
    if (result.status !== 0) {
      util.log(`[ERROR] ${fullPath} Failed to upload`);
    } else {
      util.log(`[INFO] ${fullPath} was successfully uploaded`);
    }
  }
}

export default { upload };
