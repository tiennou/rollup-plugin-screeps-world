# Rollup Screeps Plugin

## Install

```sh
npm install --save-dev rollup-plugin-screeps-world

```

## Usage

In `rollup.config.js`

```js
import screeps from "rollup-plugin-screeps-world";

...

export default {
  ...
  sourcemap: true, // If set to true your source maps will be made screeps friendly and uploaded

  plugins: [
    ...
    screeps({configFile: "./screeps.json"})
  ]
}

```

### Config File

rollup-plugin-screeps needs your screeps username/password and the server to upload to.

```json
{
  "token": "abcdef12345",
  "protocol": "https",
  "hostname": "screeps.com",
  "port": 443,
  "path": "/",
  "branch": "auto"
}

```

If `branch` is set to `"auto"` rollup-plugin-screeps will use your current git branch as the name of the branch on screeps, if you set it to anything else that string will be used as the name of the branch.
