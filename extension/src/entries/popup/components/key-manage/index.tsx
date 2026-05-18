import { useGlobalContext } from "@src/hooks/useGlobalContext"
import { useSealXNavigate } from "../../hooks/useSealXNavigate"
import AddressCardIcon from '@assets/svg/address-card.svg?react'
import Button from "@src/components/button"
import './styles.css'

export const KeyManage = () => {
    const navigate = useSealXNavigate()
    const { address } = useGlobalContext()
    return <div className="key-manage-page">
        <section className="key-manage-card">
            <div className="key-manage-header">
                <div>
                    <h1>Key Mgmt</h1>
                    <p>Local key ready</p>
                </div>
                <span className="key-status-dot" aria-hidden="true"></span>
            </div>

            <div className='key-pubkey-block'>
                <div className='key-pubkey-label'>
                    <AddressCardIcon></AddressCardIcon>
                    <span>Pubkey</span>
                </div>
                <div className='key-pubkey-value'>
                    {address || 'Not initialized'}
                </div>
            </div>

            <div className='key-action-grid'>
                <Button
                    variant="primary"
                    onClick={() => navigate('/key-export')}
                >
                    Export
                </Button>
                <Button
                    variant="secondary"
                    onClick={() => navigate('/key-import')}
                >
                    Import
                </Button>
            </div>
        </section>
    </div>
}
