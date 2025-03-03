declare module 'rollup-plugin-clear' {
    interface ClearOptions {
        targets: string[];
        watch?: boolean;
    }
    function clear(options: ClearOptions): import('rollup').PluginImpl;
    export = clear
}