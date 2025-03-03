"use strict";

import { exec, execSync } from 'child_process';
import { exit } from 'process';
import puppeteer from 'puppeteer';
import si from 'systeminformation';
import util from './util.js';

async function getConfig() {
  // CPU
  const cpuData = await si.cpu();
  util.cpuThreads = Number(cpuData.physicalCores) / 2;
  let cpuName = cpuData.brand;
  const cpuManufacturer = cpuData.manufacturer;
  if (cpuManufacturer.includes("Intel")) {
    cpuName = cpuName.split(" ").pop();
  } else if (cpuManufacturer.includes("AMD")) {
    // Trim the brand name, e.g. Ryzen 7 4700U with Radeon Graphics -> Ryzen 7
    // 4700U
    cpuName = cpuName.split(" ").slice(0, 3).join(" ");
  }
  util["cpuName"] = cpuName;

  // GPU
  if (util["platform"] === "win32") {
    const info = execSync("powershell -c \"Get-CIMInstance -query 'select * from win32_VideoController'\"")
      .toString()
      .split("\n");
    for (let i = 1; i < info.length; i++) {
      let match;
      match = info[i].match("^DriverVersion.*: (.*)");
      if (match) {
        util["gpuDriverVersion"] = match[1];
      }

      match = info[i].match("^Name .*: (.*)");
      if (match) {
        util["gpuName"] = match[1];
      }
      match = info[i].match("^PNPDeviceID.*DEV_(.{4})");
      if (match) {
        util["gpuDeviceId"] = match[1].toUpperCase();
      }
      match = info[i].match("^PNPDeviceID.*VEN_(.{4})");
      if (match) {
        util["gpuVendorId"] = match[1].toUpperCase();
      }
      match = info[i].match("^Status=(.*)");
      if (match) {
        if (util["gpuName"].match("Microsoft")) {
          continue;
        }
        if (match[1] == "OK") {
          break;
        }
      }
    }
  } else {
    const gpuData = await si.graphics();
    for (let i = 0; i < gpuData.controllers.length; i++) {
      if (gpuData.controllers[i].vendor == "Microsoft") {
        continue;
      }
      util["gpuName"] = gpuData.controllers[i].model;
    }

    if (util["platform"] === "darwin") {
      const osInfo = await si.osInfo();
      util["gpuDriverVersion"] = osInfo.release;
    } else if (util["platform"] === "linux") {
      util["gpuDriverVersion"] = execSync('glxinfo |grep "OpenGL version"').toString().trim().split(" ").pop();
    }
  }

  // OS version
  if (util["platform"] === "win32") {
    util["osVersion"] = await new Promise((resolve, reject) => {
      exec("ver", (error, stdout, stderr) => {
        resolve(stdout);
      });
    });
  } else if (util["platform"] === "darwin" || util["platform"] === "linux") {
    const osInfo = await si.osInfo();
    util["osVersion"] = osInfo.release;
  }

  // Chrome
  if (util.mode === "web" && util["platform"] === "win32" && util.args["browser"].match("chrome")) {
    const info = execSync(
      `reg query "HKEY_CURRENT_USER\\Software\\Google\\${util['browserName']}\\BLBeacon" /v version`
    ).toString();
    const match = info.match("REG_SZ (.*)");
    util["browserVersion"] = match[1];
  }

  // Edge
  if (util.mode === "web" && util["platform"] === "win32" && util.args["browser"].match("edge")) {
    const info = execSync(
      `reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\${util['browserName']}\\BLBeacon" /v version`
    ).toString();
    const match = info.match("REG_SZ (.*)");
    util["browserVersion"] = match[1];
  }

  if (util["platform"] !== "win32" && util["platform"] !== "darwin" && util["platform"] !== "linux") {
    getExtraConfig();
  }
}

/*
 * Get extra config info via Chrome
 */
async function getExtraConfig() {
  const browser = await puppeteer.launch({
    defaultViewport: null,
    executablePath: util["browserPath"],
    headless: false,
    ignoreHTTPSErrors: true,
    userDataDir: util.userDataDir,
  });

  const page = await browser.newPage();

  // Chrome version and revision
  await page.goto("chrome://version");
  const chromeNameElem = await page.$("#inner > tbody > tr:nth-child(1) > td.label");
  let chromeName = await chromeNameElem.evaluate((element) => element.innerText);
  const chromeRevisionElem = await page.$("#inner > tbody > tr:nth-child(2) > td.version");
  util["chromeRevision"] = await chromeRevisionElem.evaluate((element) => element.innerText);

  if (chromeName.includes("Chromium")) {
    chromeName = "Chromium";
  } else {
    chromeName = "Chrome";
  }
  const versionElement = await page.$("#version");
  util["browserVersion"] = await versionElement.evaluate((element) => element.innerText);

  // gpuDriverVersion and
  await page.goto("chrome://gpu");
  let gpuInfo = await page.evaluate(() => {
    try {
      let value = document
        .querySelector("info-view")
        .shadowRoot.querySelector("#basic-info")
        .querySelector("info-view-table")
        .shadowRoot.querySelector("#info-view-table")
        .children[4].shadowRoot.querySelector("#value").innerText;
      let match = value.match("DEVICE=0x([A-Za-z0-9]{4}).*DRIVER_VERSION=(.*) ");
      return [match[1], match[2]];
    } catch (error) {
      return ["ffff", "NA"];
    }
  });

  util["gpuDeviceId"] = gpuInfo[0].toUpperCase();
  // Could not get device id
  const hostname = util["hostname"];
  if (gpuInfo[0] === "FFFF") {
    if (hostname === "shwde7779") {
      util["gpuDeviceId"] = "9A49";
    } else if (hostname === "bjwdeotc009") {
      util["gpuDeviceId"] = "3E98";
    } else if (hostname === "wp-42") {
      util["gpuDeviceId"] = "9A49";
    }
  }

  util["gpuDriverVersion"] = gpuInfo[1];

  await browser.close();
}

export default { getConfig };
