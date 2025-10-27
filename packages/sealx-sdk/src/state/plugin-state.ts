import { BehaviorSubject } from 'rxjs'

export default class PluginState {
    private installed$ = new BehaviorSubject<boolean>(false)

    setInstalled(value: boolean) {
        this.installed$.next(value)
    }

    isInstalled$() {
        return this.installed$.asObservable()
    }
}