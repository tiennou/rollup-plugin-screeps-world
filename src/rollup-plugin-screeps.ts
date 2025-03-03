import { ScreepsAPI } from 'screeps-api'
import * as fs from 'fs'
import * as git from 'git-rev-sync'
import * as path from 'path'
import { Plugin, OutputOptions, OutputBundle, OutputAsset, } from 'rollup';


export interface ScreepsConfig {
  token?: string
  email?: string
  password?: string
  protocol: "http" | "https",
  hostname: string,
  port: number,
  path: string,
  branch: string | "auto"
}

export interface ScreepsOptions {
  configFile?: string
  config?: ScreepsConfig
  server?: string
  branch?: string
  dryRun?: boolean
}

export interface BinaryModule {
  binary: string
}

export interface CodeList{
  [key: string]: string | BinaryModule
}

function fixupSourcemaps(bundle: OutputBundle) {
  for (const file in bundle) {
    const item = bundle[file]
    if (item.type !== "chunk" || !item.map) continue

    // If there's a source map, post-process it
    // We need to add a .js extension and make it a module
    // to satisfy the server
    const sourcemapFile = item.sourcemapFileName!
    item.sourcemapFileName += ".js"
    const sourcemap = bundle[sourcemapFile] as OutputAsset
    delete bundle[sourcemapFile]
    bundle[item.sourcemapFileName!] = sourcemap
    sourcemap.fileName += ".js"
    sourcemap.source = "module.exports = " + sourcemap.source
  }
}

export function validateConfig(cfg: Partial<ScreepsConfig>): cfg is ScreepsConfig {
  if(cfg.hostname && cfg.hostname === 'screeps.com'){
    return [
      typeof cfg.token === "string",
      cfg.protocol === "http" || cfg.protocol === "https",
      typeof cfg.hostname === "string",
      typeof cfg.port === "number",
      typeof cfg.path === "string",
      typeof cfg.branch === "string"
    ].reduce((a,b) => a && b)
  }

  return [
    (typeof cfg.email === 'string' && typeof cfg.password === 'string') || typeof cfg.token === 'string',
    cfg.protocol === "http" || cfg.protocol === "https",
    typeof cfg.hostname === "string",
    typeof cfg.port === "number",
    typeof cfg.path === "string",
    typeof cfg.branch === "string"
  ].reduce((a, b) => a && b)
}

export function loadConfigFile(configFile: string) {
  let data = fs.readFileSync(configFile, 'utf8')
  let cfg = JSON.parse(data) as Partial<ScreepsConfig>
  if(cfg.email && cfg.password && !cfg.token && cfg.hostname === 'screeps.com'){ console.log('Please change your email/password to a token') }  
  return cfg;
}

export async function loadApi(opts: ScreepsOptions) {
  if (opts.config || opts.configFile) {
    let config = opts.config || loadConfigFile(opts.configFile!)
    if (!validateConfig(config)) throw new TypeError("Invalid config")
    const api = new ScreepsAPI(config)
    if (!config.token) await api.auth(config.email, config.password)
    return api
  }
  return ScreepsAPI.fromConfig(opts.server ?? process.env.SCREEPS_SERVER ?? 'main', false, { branch: opts.branch ?? process.env.SCREEPS_BRANCH });
}

export function uploadSource(api: ScreepsAPI, options: OutputOptions, bundle: OutputBundle) {
  let code = getFileList(options.file!)
  let branch = getBranchName((<Record<string, string>>api.opts).branch)
  runUpload(api, branch!, code)
}

export function runUpload(api: any, branch: string, code: CodeList){
  api.raw.user.branches().then((data: any) => {
    let branches = data.list.map((b: any) => b.branch)

    if (branches.includes(branch)) {
      api.code.set(branch, code)
    } else {
      api.raw.user.cloneBranch('', branch, code)
    }
  })
}

export function getFileList(outputFile: string) {
  let code: CodeList = {}
  let base = path.dirname(outputFile)
  let files = fs.readdirSync(base).filter((f) =>  path.extname(f) === '.js' || path.extname(f) === '.wasm' )
  files.map((file) => {
    if (file.endsWith('.js')) {
        code[file.replace(/\.js$/i, '')] = fs.readFileSync(path.join(base, file), 'utf8');
    } else {
        code[file.replace(/\.wasm$/i, '')] = {
            binary: fs.readFileSync(path.join(base, file)).toString('base64')
        }
    }
  })
  return code
}

export function getBranchName(branch: string | undefined) {
  if (!branch || branch === 'auto') {
    return git.branch()
  } else {
    return branch
  }
}

const ex = (x: any) => JSON.stringify(x, null, 2);

export function screeps(screepsOptions: ScreepsOptions = {}) {
  return {
    name: "screeps",

    generateBundle(options: OutputOptions, bundle: OutputBundle, isWrite: boolean) {
      if (options.sourcemap) fixupSourcemaps(bundle);
    },

    async writeBundle(options: OutputOptions, bundle: OutputBundle) {
      if (!screepsOptions.dryRun) {
        uploadSource(await loadApi(screepsOptions), options, bundle);
      }
    }
  } as Plugin;
}

export default screeps