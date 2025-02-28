function setup() {

  if ('kill-chrome' in util.args) {
    spawnSync('cmd', ['/c', 'taskkill /F /IM chrome.exe /T']);
  }

  // set util members
  let browserName;
  let browserPath;
  let userDataDir;
  if (util.args['browser'] === 'chrome_canary') {
    browserName = 'Chrome SxS';
    if (util.platform === 'darwin') {
      browserPath =
        '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
      userDataDir = `/Users/${os.userInfo()
        .username}/Library/Application Support/Google/Chrome Canary`;
    } else if (util.platform === 'linux') {
      // There is no Canary channel for Linux, use dev channel instead
      browserPath = '/usr/bin/google-chrome-unstable';
      userDataDir =
        `/home/${os.userInfo().username}/.config/google-chrome-unstable`;
    } else if (util.platform === 'win32') {
      browserPath = `${process.env.LOCALAPPDATA}/Google/Chrome SxS/Application/chrome.exe`;
      userDataDir =
        `${process.env.LOCALAPPDATA}/Google/${browserName}/User Data`;
    }
  } else if (util.args['browser'] === 'chrome_dev') {
    browserName = 'Chrome Dev';
    if (util.platform === 'darwin') {
      browserPath =
        '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev';
      userDataDir = `/Users/${os.userInfo()
        .username}/Library/Application Support/Google/Chrome Dev`;
    } else if (util.platform === 'linux') {
      browserPath = '/usr/bin/google-chrome-unstable';
      userDataDir =
        `/home/${os.userInfo().username}/.config/google-chrome-unstable`;
    } else if (util.platform === 'win32') {
      browserPath = `${process.env.PROGRAMFILES}/Google/Chrome Dev/Application/chrome.exe`;
      userDataDir =
        `${process.env.LOCALAPPDATA}/Google/${browserName}/User Data`;
    }
  } else if (util.args['browser'] === 'chrome_beta') {
    browserName = 'Chrome Beta';
    if (util.platform === 'darwin') {
      browserPath =
        '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta';
      userDNameir = `/Users/${os.userInfo()
        .username}/Library/Application Support/Google/Chrome Beta`;
    } else if (util.platform === 'linux') {
      browserPath = '/usr/bin/google-chrome-beta';
      userDataDir =
        `/home/${os.userInfo().username}/.config/google-chrome-beta`;
    } else if (util.platform === 'win32') {
      browserPath = `${process.env.PROGRAMFILES}/Google/Chrome Beta/Application/chrome.exe`;
      userDataDir =
        `${process.env.LOCALAPPDATA}/Google/${browserName}/User Data`;
    }
  } else if (util.args['browser'] === 'chrome_stable') {
    browserName = 'Chrome';
    if (util.platform === 'darwin') {
      browserPath =
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      userDataDir = `/Users/${os.userInfo().username}/Library/Application Support/Google/Chrome`;
    } else if (util.platform === 'linux') {
      browserPath = '/usr/bin/google-chrome-stable';
      userDataDir =
        `/home/${os.userInfo().username}/.config/google-chrome-stable`;
    } else if (util.platform === 'win32') {
      browserPath =
        `${process.env.PROGRAMFILES}/Google/Chrome/Application/chrome.exe`;
      userDataDir =
        `${process.env.LOCALAPPDATA}/Google/${browserName}/User Data`;
    }
  } else if (util.args['browser'] === 'edge_canary') {
    browserName = 'Edge SXS';
    if (util.platform === 'win32') {
      browserPath =
        `${process.env.LOCALAPPDATA}/Microsoft/Edge SXS/Application/msedge.exe`;
      userDataDir =
        `${process.env.LOCALAPPDATA}/Microsoft/${browserName}/User Data`;
    }
  } else if (util.args['browser'] === 'edge_stable') {
    browserName = 'Edge';
    if (util.platform === 'win32') {
      browserPath =
        `${process.env["PROGRAMFILES(X86)"]}/Microsoft/Edge/Application/msedge.exe`;
      userDataDir =
        `${process.env.LOCALAPPDATA}/Microsoft/${browserName}/User Data`;
    }
  }
  else {
    browserName = util.args['browser'];
    browserPath = util.args['browser'];
    userDataDir = `${util.outDir}/user-data-dir`;
  }

  util.browserName = browserName;
  // TODO: handle space in edge_stable's path
  util.browserPath = browserPath;
  //console.log(util.browserPath);
  util.userDataDir = userDataDir;
  if ('cleanup-user-data-dir' in util.args) {
    console.log('Cleanup user data dir');
    util.ensureNoDir(userDataDir);
  }

  if (util.platform === 'linux') {
    util.browserArgs.push(
      ...['--enable-unsafe-webgpu', '--use-angle=vulkan',
        '--enable-features=Vulkan']);
  }
  if (util.platform === 'darwin') {
    util.browserArgs.push('--use-mock-keychain');
  }
  if ('browser-args' in util.args) {
    util.browserArgs.push(...util.args['browser-args'].split(' '));
  }

  if ('enable-trace' in util.args) {
    util.webUrlArgs.push('enableTrace=true');
    util.browserArgs.push(
      ...['--enable-unsafe-webgpu',
        '--enable-dawn-features=allow_unsafe_apis,use_dxc,record_detailed_timing_in_trace_events,disable_timestamp_query_conversion',
        '--trace-startup=devtools.timeline,disabled-by-default-gpu.dawn',
        '--trace-startup-format=json',
      ]);
  }
}

export default {
  setup,
};
