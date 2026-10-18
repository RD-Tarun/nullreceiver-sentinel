import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ShieldAlert, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  Activity, 
  Server, 
  Cpu, 
  Key, 
  Wallet, 
  FileCode,
  Info
} from 'lucide-react';
import './App.css';

const DEFAULT_TARGET_ADDRESS = "0xa322E5f3D311D3080e6f0121063e9aDC2490Ef1a";
const DEFAULT_API_KEY = "PMEHZSC3FV9KFMGPINSRQIABKXTMVX29T5";

export function decodeAddressBytes(rawAddress) {
  if (!rawAddress) return null;
  let clean = rawAddress.trim();
  if (clean.toLowerCase().startsWith("0x")) {
    clean = clean.slice(2);
  }

  if (clean.length !== 40) {
    return {
      error: `Address length is ${clean.length} hex characters (expected 40).`,
      clean
    };
  }

  const p1 = clean.slice(0, 8);
  const p2 = clean.slice(8, 16);
  const pRest = clean.slice(16);

  const hexToIp = (hex) => {
    const octets = [];
    for (let i = 0; i < 8; i += 2) {
      octets.push(parseInt(hex.slice(i, i + 2), 16));
    }
    return octets.join('.');
  };

  const hexToAscii = (hex) => {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16);
      str += (code >= 32 && code <= 126) ? String.fromCharCode(code) : '.';
    }
    return str;
  };

  return {
    prefix: "0x",
    part1Hex: p1,
    part2Hex: p2,
    restHex: pRest,
    ip1: hexToIp(p1),
    ip2: hexToIp(p2),
    marker: hexToAscii(pRest),
    clean
  };
}

export default function App() {
  const [targetAddress, setTargetAddress] = useState(
    () => localStorage.getItem("ioc_target_addr") || DEFAULT_TARGET_ADDRESS
  );
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("ioc_etherscan_key") || DEFAULT_API_KEY
  );
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoInterval, setAutoInterval] = useState(30);
  const [countdown, setCountdown] = useState(30);
  const [toastMsg, setToastMsg] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  
  // Custom Dissector
  const [customInput, setCustomInput] = useState("0x67B38e9b67B38E9b68656c6C6f6970626f742121");
  const [customDecoded, setCustomDecoded] = useState(null);

  const timerRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Copied: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem("ioc_target_addr", targetAddress);
  }, [targetAddress]);

  useEffect(() => {
    localStorage.setItem("ioc_etherscan_key", apiKey);
  }, [apiKey]);

  // Update dissector on input change
  useEffect(() => {
    setCustomDecoded(decodeAddressBytes(customInput));
  }, [customInput]);

  // Main Fetch Function
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    let items = [];

    // Attempt 1: Etherscan API V2
    try {
      const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${targetAddress}&startblock=0&endblock=99999999&page=1&offset=15&sort=desc&apikey=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "1" && Array.isArray(data.result)) {
        items = data.result.map(tx => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          timeStamp: parseInt(tx.timeStamp, 10),
          value: tx.value,
          decoded: decodeAddressBytes(tx.to)
        }));
      } else {
        throw new Error(data.result || data.message || "Etherscan non-OK response");
      }
    } catch (err) {
      // Attempt 2: Blockscout Fallback
      try {
        const bsUrl = `https://eth.blockscout.com/api/v2/addresses/${targetAddress}/transactions`;
        const bsRes = await fetch(bsUrl);
        const bsData = await bsRes.json();
        if (bsData && Array.isArray(bsData.items)) {
          items = bsData.items.slice(0, 15).map(tx => ({
            hash: tx.hash,
            from: tx.from?.hash || "",
            to: tx.to?.hash || "",
            timeStamp: Math.floor(new Date(tx.timestamp).getTime() / 1000),
            value: tx.value,
            decoded: decodeAddressBytes(tx.to?.hash)
          }));
        }
      } catch (bsErr) {
        showToast("Error retrieving transactions from API endpoints.");
      }
    }

    setTransactions(items);
    setLoading(false);
    setLastUpdated(new Date());
    setCountdown(autoInterval);
  }, [targetAddress, apiKey, autoInterval]);

  // Initial fetch
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Auto-refresh countdown
  useEffect(() => {
    if (autoInterval <= 0) return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchTransactions();
          return autoInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [autoInterval, fetchTransactions]);

  // Determine latest active C2 from outbound transactions
  const latestOutbound = transactions.find(
    tx => tx.from.toLowerCase() === targetAddress.toLowerCase() && tx.to
  ) || transactions[0];

  const activeDecoded = latestOutbound ? latestOutbound.decoded : null;

  // Export functions
  const exportJSON = () => {
    const payload = {
      targetWallet: targetAddress,
      generatedAt: new Date().toISOString(),
      threatCampaign: "NullReceiver",
      activeC2: activeDecoded?.ip1,
      backupC2: activeDecoded?.ip2,
      marker: activeDecoded?.marker,
      transactions: transactions
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nullreceiver-iocs-${Date.now()}.json`;
    a.click();
    showToast("IoC JSON exported.");
  };

  const exportCSV = () => {
    const headers = ["Timestamp_UTC", "Tx_Hash", "From_Address", "To_Address", "Primary_C2_IP", "Secondary_C2_IP", "Marker"];
    const rows = transactions.map(t => {
      const d = t.decoded;
      const ts = new Date(t.timeStamp * 1000).toISOString();
      return `"${ts}","${t.hash}","${t.from}","${t.to}","${d?.ip1 || ''}","${d?.ip2 || ''}","${d?.marker || ''}"`;
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nullreceiver-iocs-${Date.now()}.csv`;
    a.click();
    showToast("IoC CSV exported.");
  };

  const copySuricataRule = () => {
    if (!activeDecoded?.ip1) return;
    const rule = `alert ip any any -> ${activeDecoded.ip1} any (msg:"ET MALWARE Contagious Interview / NullReceiver C2 Communication"; flow:established,to_server; reference:url,github.com; classtype:trojan-activity; sid:9000101; rev:1;)`;
    copyToClipboard(rule, "suricata");
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="glass-panel app-header" id="app-header">
        <div className="header-brand">
          <div className="brand-icon-box">
            <ShieldAlert size={26} />
          </div>
          <div>
            <h1 className="brand-title">
              NullReceiver Monitor
              <span className="badge badge-threat">MONITORING</span>
            </h1>
            <p className="brand-subtitle">
              Ethereum On-Chain Dead-Drop Decoder
            </p>
          </div>
        </div>

        <div className="header-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span className="live-pulse"></span>
            <span>{autoInterval > 0 ? `Interval: ${countdown}s` : 'Paused'}</span>
          </div>

          <select 
            id="refresh-select"
            className="refresh-select" 
            value={autoInterval} 
            onChange={(e) => {
              const val = Number(e.target.value);
              setAutoInterval(val);
              setCountdown(val);
            }}
          >
            <option value={10}>Interval: 10s</option>
            <option value={30}>Interval: 30s</option>
            <option value={60}>Interval: 60s</option>
            <option value={0}>Pause</option>
          </select>

          <button 
            id="scan-button"
            className="btn btn-primary" 
            onClick={fetchTransactions} 
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
            {loading ? "Querying Ledger..." : "Refresh"}
          </button>
        </div>
      </header>

      {/* Configuration Bar */}
      <section className="glass-panel config-bar" id="config-bar">
        <div className="config-inputs">
          <div className="input-group">
            <label className="input-label" htmlFor="target-address-input">
              <Wallet size={13} /> Monitored Operator Wallet
            </label>
            <input 
              id="target-address-input"
              className="text-input" 
              value={targetAddress} 
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="0x..." 
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="api-key-input">
              <Key size={13} /> Etherscan API V2 Key
            </label>
            <input 
              id="api-key-input"
              type="password"
              className="text-input" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API Key" 
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button id="export-json-btn" className="btn btn-secondary" onClick={exportJSON}>
            <Download size={14} /> Export JSON
          </button>
          <button id="export-csv-btn" className="btn btn-secondary" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </section>

      {/* Hero Grid */}
      <section className="hero-grid">
        {/* Active C2 Card */}
        <div className="glass-panel c2-hero-card" id="active-c2-card">
          <div className="card-title-row">
            <div className="card-title">
              <Server size={17} color="var(--accent-rose)" /> Active Command & Control Address
            </div>
            <span className="badge badge-threat">RESOLVED C2</span>
          </div>

          <div className="c2-display-row">
            <div className="c2-ip-main font-mono">
              {activeDecoded?.ip1 || "Pending resolution"}
              {activeDecoded?.ip1 && (
                <button 
                  id="copy-c2-btn"
                  className="btn btn-secondary" 
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  onClick={() => copyToClipboard(activeDecoded.ip1, "hero_c2")}
                >
                  {copiedKey === "hero_c2" ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                  Copy IP
                </button>
              )}
            </div>

            <div className="c2-badge-container">
              <button 
                id="copy-suricata-btn"
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={copySuricataRule}
              >
                <FileCode size={14} color="var(--accent-cyan)" />
                {copiedKey === "suricata" ? "Copied" : "Copy Suricata Rule"}
              </button>
            </div>
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-label">Secondary / Backup C2</span>
              <span className="stat-value font-mono">
                {activeDecoded?.ip2 || "None"}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Signature Marker</span>
              <span className="stat-value font-mono">
                <span className="badge badge-marker">
                  {activeDecoded?.marker || "None"}
                </span>
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Recipient Destination Address</span>
              <span className="stat-value font-mono" style={{ fontSize: '0.8rem' }}>
                {latestOutbound?.to || "None"}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Last Ledger Timestamp</span>
              <span className="stat-value">
                {latestOutbound ? new Date(latestOutbound.timeStamp * 1000).toUTCString() : "None"}
              </span>
            </div>
          </div>
        </div>

        {/* Technical Context */}
        <div className="glass-panel campaign-card" id="campaign-card">
          <div>
            <div className="card-title-row">
              <div className="card-title">
                <Info size={17} color="var(--accent-cyan)" /> Technical Context
              </div>
              <span className="badge badge-cyan">DETAILS</span>
            </div>
            <p className="campaign-desc">
              The NullReceiver dead-drop mechanism utilizes zero-value Ethereum transactions to relay command-and-control IP addresses. Backdoors query the recipient address of transactions sent from the designated operator wallet to dynamically reconstruct communication endpoints without embedding cleartext infrastructure.
            </p>
          </div>

          <div>
            <div className="input-label" style={{ marginBottom: '6px' }}>Classification</div>
            <div className="campaign-tag-list">
              <span className="badge badge-cyan">MITRE ATT&CK: T1102.001</span>
              <span className="badge badge-cyan">Dead-Drop Resolver</span>
              <span className="badge badge-marker">Marker: helloipbot!!</span>
              <span className="badge badge-threat">C2 Infrastructure</span>
            </div>
          </div>
        </div>
      </section>

      {/* Address Byte Decoder */}
      <section className="glass-panel dissector-card" id="byte-dissector-section">
        <div className="card-title-row">
          <div className="card-title">
            <Cpu size={17} color="var(--accent-purple)" /> Address Byte Decoder
          </div>
          <span className="badge badge-marker">SPECIFICATION</span>
        </div>

        <div className="dissector-input-row">
          <input 
            id="dissector-input"
            className="text-input" 
            style={{ flex: 1 }}
            value={customInput} 
            onChange={(e) => setCustomInput(e.target.value)} 
            placeholder="0x..."
          />
          <button 
            id="reset-dissector-btn"
            className="btn btn-secondary"
            onClick={() => setCustomInput(latestOutbound?.to || "0x67B38e9b67B38E9b68656c6C6f6970626f742121")}
          >
            Load Latest
          </button>
        </div>

        {customDecoded && !customDecoded.error ? (
          <div className="byte-visualizer-container">
            <div className="byte-chunks-row">
              <div className="byte-chip chip-prefix">
                <span>0x</span>
                <span className="chip-subtext">Prefix</span>
              </div>
              <div className="byte-chip chip-ip1">
                <span>{customDecoded.part1Hex}</span>
                <span className="chip-subtext">Primary IP (4B)</span>
              </div>
              <div className="byte-chip chip-ip2">
                <span>{customDecoded.part2Hex}</span>
                <span className="chip-subtext">Backup IP (4B)</span>
              </div>
              <div className="byte-chip chip-marker">
                <span>{customDecoded.restHex}</span>
                <span className="chip-subtext">Signature Marker (12B)</span>
              </div>
            </div>

            <div className="byte-legend-grid">
              <div className="legend-card" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
                <div className="legend-header" style={{ color: 'var(--accent-cyan)' }}>
                  <span>Primary IPv4</span>
                </div>
                <div className="legend-detail">{customDecoded.ip1}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Bytes: {customDecoded.part1Hex.match(/.{1,2}/g)?.join(' ')}
                </div>
              </div>

              <div className="legend-card" style={{ borderLeft: '3px solid var(--accent-emerald)' }}>
                <div className="legend-header" style={{ color: 'var(--accent-emerald)' }}>
                  <span>Secondary IPv4</span>
                </div>
                <div className="legend-detail">{customDecoded.ip2}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Bytes: {customDecoded.part2Hex.match(/.{1,2}/g)?.join(' ')}
                </div>
              </div>

              <div className="legend-card" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
                <div className="legend-header" style={{ color: 'var(--accent-purple)' }}>
                  <span>Signature Marker</span>
                </div>
                <div className="legend-detail">"{customDecoded.marker}"</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  12-byte tracking string
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--accent-rose)', fontSize: '0.85rem' }}>
            {customDecoded?.error || "Invalid address format"}
          </div>
        )}
      </section>

      {/* Transaction History & Ledger */}
      <section className="glass-panel table-card" id="transactions-ledger-section">
        <div className="card-title-row">
          <div className="card-title">
            <Activity size={17} color="var(--accent-blue)" /> On-Chain Transactions
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            {transactions.length} recorded transactions
          </div>
        </div>

        <div className="table-responsive">
          <table className="ioc-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Tx Hash</th>
                <th>Direction</th>
                <th>Destination Address</th>
                <th>Primary C2</th>
                <th>Backup C2</th>
                <th>Signature Marker</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    {loading ? "Querying ledger..." : "No transactions found."}
                  </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => {
                  const d = tx.decoded;
                  const isOutbound = tx.from.toLowerCase() === targetAddress.toLowerCase();
                  return (
                    <tr key={tx.hash || idx}>
                      <td>{new Date(tx.timeStamp * 1000).toUTCString()}</td>
                      <td>
                        <a 
                          href={`https://etherscan.io/tx/${tx.hash}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="tx-hash-link"
                        >
                          {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}
                          <ExternalLink size={12} style={{ display: 'inline', marginLeft: '4px' }} />
                        </a>
                      </td>
                      <td>
                        <span className={`badge ${isOutbound ? 'badge-threat' : 'badge-cyan'}`}>
                          {isOutbound ? 'OUTBOUND' : 'INBOUND'}
                        </span>
                      </td>
                      <td className="font-mono" style={{ fontSize: '0.8rem' }}>
                        {tx.to ? `${tx.to.slice(0, 10)}...${tx.to.slice(-8)}` : "Contract Creation"}
                      </td>
                      <td className="font-mono">
                        {d?.ip1 ? (
                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{d.ip1}</span>
                        ) : "None"}
                      </td>
                      <td className="font-mono">
                        {d?.ip2 ? (
                          <span style={{ color: 'var(--accent-emerald)' }}>{d.ip2}</span>
                        ) : "None"}
                      </td>
                      <td>
                        {d?.marker ? (
                          <span className="badge badge-marker">{d.marker}</span>
                        ) : "—"}
                      </td>
                      <td>
                        {d?.ip1 && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => {
                              setCustomInput(tx.to);
                              window.scrollTo({ top: 350, behavior: 'smooth' });
                            }}
                          >
                            Decode
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Toast */}
      {toastMsg && (
        <div className="toast-msg">
          <Check size={16} color="var(--accent-cyan)" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div>NullReceiver Monitor &bull; Ethereum Dead-Drop Decoder</div>
      </footer>
    </div>
  );
}
