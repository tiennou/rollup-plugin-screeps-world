import { OutputOptions, rollup, RollupOptions } from 'rollup'
import * as fs from 'fs'
import * as path from "path"
import * as git from 'git-rev-sync'
import "jest-extended";

import * as _ts from "rollup-plugin-typescript2";
import * as _copy from 'rollup-plugin-copy'
import clear = require('rollup-plugin-clear')

import screeps, { getBranchName, getFileList, loadConfigFile, ScreepsConfig, validateConfig } from '../src/rollup-plugin-screeps'

const ts = _ts as unknown as typeof import('rollup-plugin-typescript2').default;
const copy = _copy as unknown as typeof import('rollup-plugin-copy').default;

const TSCONFIG = './tests/tsconfig.tests.json'

describe('Rollup Screeps Plugin', () => {
  it('should support tokens for screeps.com and email/password for any other server', () => {
    var config: ScreepsConfig = {
      "token": "foo",
      "branch": "auto",
      "protocol": "https",
      "hostname": "screeps.com",
      "port": 443,
      "path": "/"
    }

    expect(validateConfig(config)).toEqual(true)

    var config: ScreepsConfig = {
      "email": "you@domain.tld",
      "password": "foo",
      "branch": "auto",
      "protocol": "https",
      "hostname": "screeps.com",
      "port": 443,
      "path": "/"
    }

    expect(validateConfig(config)).toEqual(false)

    var config: ScreepsConfig = {
      "token": "foo",
      "branch": "auto",
      "protocol": "https",
      "hostname": "myscreeps.com",
      "port": 443,
      "path": "/"
    }

    expect(validateConfig(config)).toEqual(true)

    var config: ScreepsConfig = {
      "email": "you@domain.tld",
      "password": "foo",
      "branch": "auto",
      "protocol": "https",
      "hostname": "myscreeps.com",
      "port": 443,
      "path": "/"
    }

    expect(validateConfig(config)).toEqual(true)
  })

  it('should generate source maps', async function(){
    const options: RollupOptions = {
      input: './tests/fixtures/main.ts',
      output: {
        file: './tests/dist/main.js',
        sourcemap: true,
        format: 'cjs'
      },
      plugins: [
        clear({"targets": ["./tests/dist"]}),
        ts({tsconfig: TSCONFIG}),
        screeps({dryRun: true})
      ]
    }

    let outputOpts = options.output as OutputOptions;
    let build = await rollup(options);
    let output = (await build.write(outputOpts)).output;
    
    // Iterate through bundle and test if type===chunk && map is defined
    for (let item of output) {
      if (item.type === "chunk" && item.map) {

        expect(item.map.toString()).toMatch(/^module.exports/)
      }
    }
    var basePath = path.join(__dirname, 'dist')
    var originalPath = path.join(basePath, 'main.js.map')
    var newPath = path.join(basePath, 'main.js.map.js')

    expect(fs.existsSync(originalPath)).toEqual(false)
    expect(fs.existsSync(newPath)).toEqual(true)

  })

  it('should generate branch name', async function(){
    const screepsOptions = {
      dryRun: true
    }

    const options: RollupOptions = {
      input: './tests/fixtures/main.ts',
      output: {
        file: './tests/dist/main.js',
        sourcemap: true,
        format: 'cjs'
      },
      plugins: [
        clear({"targets": ["./tests/dist"]}),
        ts({tsconfig: TSCONFIG}),
        screeps(screepsOptions)
      ]
    }

    let outputOpts = options.output as OutputOptions;
    let bundle = await rollup(options);
    let output = await bundle.generate(outputOpts);

    expect(getBranchName('auto')).toEqual(git.branch())
  })

  it('should use the branch name', async function(){
    var screepsOptions = {
      dryRun: true
    }

    const options: RollupOptions = {
      input: './tests/fixtures/main.ts',
      output: {
        file: './tests/dist/main.js',
        sourcemap: true,
        format: 'cjs'
      },
      plugins: [
        clear({"targets": ["./tests/dist"]}),
        ts({tsconfig: TSCONFIG}),
        screeps(screepsOptions)
      ]
    }

    let outputOpts = options.output as OutputOptions;
    let bundle = await rollup(options);
    let output = await bundle.generate(outputOpts);

    expect(getBranchName('ai')).toEqual('ai')
  })

  it('should create a list of files to upload', async function(){
    const screepsOptions = {
      dryRun: true
    }

    const options: RollupOptions = {
      input: './tests/fixtures/main.ts',
      output: {
        file: './tests/dist/main.js',
        sourcemap: true,
        format: 'cjs'
      },
      plugins: [
        clear({"targets": ["./tests/dist"]}),
        ts({tsconfig: TSCONFIG}),
        copy({
          targets: [
            { src: "./tests/fixtures/*.wasm", dest: "./tests/dist" }
          ]
        }),
        screeps(screepsOptions)
      ]
    };

    let outputOpts = options.output as OutputOptions;
    let bundle = await rollup(options);
    let output = await bundle.write(outputOpts);

    const code = getFileList(outputOpts.file!)

    expect(Object.keys(code).length).toEqual(3)
    expect(code.main).toMatch(/input/)
    expect(code['main.js.map']).toMatch(/^module.exports/)
  })

  it('should upload WASM files as binary modules', async function() {
    const screepsOptions = {
      dryRun: true
    }

    const options: RollupOptions = {
      input: './tests/fixtures/main.ts',
      output: {
        file: './tests/dist/main.js',
        sourcemap: true,
        format: 'cjs'
      },
      plugins: [
        clear({"targets": ["./tests/dist"]}),
        ts({tsconfig: TSCONFIG}),
        copy({
          targets: [
            { src: "./tests/fixtures/*.wasm", dest: "./tests/dist" }
          ]
        }),
        screeps(screepsOptions)
      ]
    }

    let outputOpts = options.output as OutputOptions;
    let bundle = await rollup(options);
    let output = await bundle.write(outputOpts);
    
    const code = getFileList(outputOpts.file!)

    expect(code['wasm_module']).toBeObject();
    if (typeof code['wasm_module'] === "object") {
      expect(code['wasm_module'].binary).toBeString()
    }
    expect(code.main).toBeString()
  })

  it('should get the config', function(){
    var config = loadConfigFile('./tests/fixtures/screeps.json')
    expect(config.branch).toEqual('foo')
  })
})
