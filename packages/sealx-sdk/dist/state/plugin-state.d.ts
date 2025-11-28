export default class PluginState {
    private installed$;
    setInstalled(value: boolean): void;
    isInstalled$(): import("rxjs").Observable<boolean>;
}
