import { useState, useEffect } from 'react'
import freighter from '@stellar/freighter-api'
import * as StellarSdk from 'stellar-sdk'
import './App.css'

const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org')

function App() {
  const [walletAddress, setWalletAddress] = useState(null)
  const [balance, setBalance] = useState(null)
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [txStatus, setTxStatus] = useState(null)
  const [txHash, setTxHash] = useState('')

  useEffect(() => {
    if (walletAddress) {
      fetchBalance(walletAddress)
    }
  }, [walletAddress])

  const connectWallet = async () => {
    try {
      const connectionResult = await freighter.isConnected()
      if (!connectionResult.isConnected) {
        alert('Please install Freighter wallet!')
        return
      }
      await freighter.requestAccess()
      const publicKeyResult = await freighter.getAddress()
      setWalletAddress(publicKeyResult.address)
    } catch (error) {
      console.error('Connection failed:', error)
      alert('Failed to connect wallet')
    }
  }

  const disconnectWallet = () => {
    setWalletAddress(null)
    setBalance(null)
    setTxStatus(null)
    setTxHash('')
  }

  const fetchBalance = async (address) => {
    try {
      const account = await server.loadAccount(address)
      const xlmBalance = account.balances.find(b => b.asset_type === 'native')
      setBalance(xlmBalance ? xlmBalance.balance : '0')
    } catch (error) {
      console.error('Balance fetch failed:', error)
      setBalance('Account not funded yet')
    }
  }

  const sendPayment = async () => {
    if (!recipient || !amount) {
      alert('Please fill in recipient and amount')
      return
    }

    setTxStatus('loading')
    setTxHash('')

    try {
      const account = await server.loadAccount(walletAddress)

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: recipient,
            asset: StellarSdk.Asset.native(),
            amount: amount.toString(),
          })
        )
        .setTimeout(30)
        .build()

      const signedResult = await freighter.signTransaction(transaction.toXDR(), {
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })

      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signedResult.signedTxXdr,
        StellarSdk.Networks.TESTNET
      )

      const result = await server.submitTransaction(signedTx)

      setTxHash(result.hash)
      setTxStatus('success')
      fetchBalance(walletAddress)
    } catch (error) {
      console.error('Transaction failed:', error)
      setTxStatus('error')
    }
  }

  return (
    <div className="container">
      <h1>Stellar Payment dApp</h1>

      {!walletAddress ? (
        <div className="wallet-box">
          <p>Connect your Freighter wallet to get started</p>
          <button onClick={connectWallet}>Connect Wallet</button>
        </div>
      ) : (
        <div>
          <div className="wallet-info">
            <p className="label">Connected Wallet</p>
            <p className="address">
              {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
            </p>
            <p className="label">XLM Balance</p>
            <p className="balance">
              {balance !== null ? balance + ' XLM' : 'Loading...'}
            </p>
            <button className="disconnect-btn" onClick={disconnectWallet}>
              Disconnect
            </button>
          </div>

          <div className="payment-form">
            <h2>Send XLM</h2>
            <input
              type="text"
              placeholder="Recipient address (G...)"
              value={recipient}
              onChange={function(e) { setRecipient(e.target.value) }}
            />
            <input
              type="number"
              placeholder="Amount (XLM)"
              value={amount}
              onChange={function(e) { setAmount(e.target.value) }}
            />
            <button onClick={sendPayment} disabled={txStatus === 'loading'}>
              {txStatus === 'loading' ? 'Sending...' : 'Send XLM'}
            </button>
          </div>

          {txStatus === 'success' && (
            <div className="tx-success">
              <p>Transaction Successful!</p>
              <p className="tx-hash">Hash: {txHash.slice(0, 20)}...</p>
              <a
                href={'https://stellar.expert/explorer/testnet/tx/' + txHash}
                target="_blank"
                rel="noreferrer"
              >
                View on Explorer
              </a>
            </div>
          )}

          {txStatus === 'error' && (
            <div className="tx-error">
              <p>Transaction Failed. Check the address and amount and try again.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
