import { getSealxSessionTimeout, setSessionTimeout } from "@src/core/background"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import Button from "@src/components/button"
import Clock from '@assets/svg/clock.svg?react'
import './styles.css'

const TIMER_OPTIONS = [1, 2, 5, 10, 15, 30]

export const SetSessionExpire = () => {
    const [time, setTime] = useState<number>(0)
    const navigate = useSealXNavigate()
    const initTime = useCallback(async () => {
        const res = await getSealxSessionTimeout()
        if (res) {
            setTime(res)
        }
    }, [setTime])
    useEffect(() => {
        initTime()
    }, [initTime])
    const TimerItem = useMemo(() => {
        return TIMER_OPTIONS.map((t) => {
            const isSelected = time === t
            return <label
                key={t}
                className={`screen-timer-option ${isSelected ? 'is-selected' : ''}`}
            >
                <input
                    type="radio"
                    name="session-timeout"
                    value={t}
                    checked={isSelected}
                    onChange={() => setTime(t)}
                    className="sr-only"
                />
                <div className='screen-timer-option-top'>
                    <span className='screen-timer-value'>{t}</span>
                    <span className='screen-timer-unit'>min</span>
                </div>
                <div className='screen-timer-option-bottom'>
                    <span>{t <= 2 ? 'Quick lock' : t >= 15 ? 'Long session' : 'Balanced'}</span>
                    <span className='screen-timer-radio' aria-hidden='true'></span>
                </div>
            </label>
        })
    }, [time])
    const onSubmit = useCallback(async () => {
        const res = await setSessionTimeout(time)
        if (res) {
            navigate(-1)
        }
    }, [time, navigate])
    return <div className="screen-timer-page">
        <section className="screen-timer-card">
            <div className="screen-timer-header">
                <div className="screen-timer-icon">
                    <Clock />
                </div>
                <div className="screen-timer-heading">
                    <h1>Screen Timer</h1>
                    <p>Lock SealX after inactivity</p>
                </div>
            </div>
            <div className="screen-timer-current">
                <span>Current timeout</span>
                <strong>{time || '-'} min</strong>
            </div>
            <div className="screen-timer-options">
                {TimerItem}
            </div>
        </section>
        <div className='screen-timer-actions'>
            <Button
                variant="secondary"
                onClick={() => navigate(-1)}
            >
                Cancel
            </Button>
            <Button
                variant="primary"
                onClick={onSubmit}
                className="screen-timer-confirm"
                disabled={!time}
            >
                Confirm
            </Button>
        </div>
    </div>
}
